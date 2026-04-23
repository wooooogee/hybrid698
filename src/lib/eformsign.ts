const EFORMSIGN_API_SERVER = process.env.EFORMSIGN_API_SERVER || 'https://api.eformsign.com';
const EFORMSIGN_KR_SERVER = 'https://kr-api.eformsign.com';
const EFORMSIGN_SECRET_KEY = process.env.EFORMSIGN_SECRET_KEY || '';
const EFORMSIGN_API_KEY = process.env.EFORMSIGN_API_KEY || '';
export const EFORMSIGN_COMPANY_ID = process.env.EFORMSIGN_COMPANY_ID || '';
const EFORMSIGN_MEMBER_ID = process.env.EFORMSIGN_MEMBER_ID || '';
const EFORMSIGN_TEMPLATE_ID_BETTER = process.env.EFORMSIGN_TEMPLATE_ID_BETTER || '';
const EFORMSIGN_TEMPLATE_ID_Hybrid698 = process.env.EFORMSIGN_TEMPLATE_ID_Hybrid698 || '';

/**
 * Get Access Token using the specific 'Bearer' Header pattern found in Postman.
 * This pattern is used when the Secret Key is a simple string like 'test'.
 */
async function getEformsignToken(): Promise<string> {
    const timestamp = Date.now().toString();
    const apiKeyBase64 = Buffer.from(EFORMSIGN_API_KEY).toString('base64');

    const url = `${EFORMSIGN_API_SERVER}/v2.0/api_auth/access_token`;

    // Exact header pattern from the successful Postman screenshot
    const headers = {
        'Content-Type': 'application/json',
        'eformsign_signature': `Bearer ${EFORMSIGN_SECRET_KEY}`,
        'Authorization': `Bearer ${apiKeyBase64}`
    };

    const body = {
        execution_time: timestamp,
        member_id: EFORMSIGN_MEMBER_ID
    };

    console.log('--- e-FormSign Ported Auth Request ---');
    console.log('URL:', url);
    console.log('Headers:', JSON.stringify(headers, null, 2).replace(apiKeyBase64, '***').replace(EFORMSIGN_SECRET_KEY, '***'));
    console.log('Body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('--- e-FormSign Ported Auth Failure ---');
        console.error('Status:', response.status);
        console.error('Response:', errorBody);
        throw new Error(`e-FormSign Auth Error (Ported): ${errorBody}`);
    }

    const result = await response.json();
    return result.oauth_token.access_token;
}

/**
 * Get document detail including field values.
 * Used by webhook handler to retrieve contractor phone after doc_complete.
 */
export async function getDocumentDetail(documentId: string): Promise<any> {
    const token = await getEformsignToken();
    const response = await fetch(`${EFORMSIGN_KR_SERVER}/v2.0/api/documents/${documentId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`문서 조회 실패 (${response.status}): ${errBody}`);
    }

    return response.json();
}

/**
 * eformsign 자체 열람 알림톡/SMS 발송 (outsides API).
 * 웹훅(doc_complete) 수신 후 백업 경로로 호출.
 * 정상 경로: createEformsignDocument의 recipients(step_type 07)로 이폼사인이 자동 발송.
 */
export async function sendViewerNotification(
    documentId: string,
    name: string,
    phone: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const token = await getEformsignToken();
        const cleanPhone = phone.replace(/\D/g, '');

        // outsides 엔드포인트는 document.recipients 가 아닌 outsides 배열 사용
        const body = {
            outsides: [
                {
                    name: name,
                    use_sms: true,
                    sms: {
                        country_code: '+82',
                        phone_number: cleanPhone,
                    },
                },
            ],
        };

        const response = await fetch(
            `${EFORMSIGN_KR_SERVER}/v2.0/api/documents/${documentId}/outsides`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        const resText = await response.text();
        console.log('[eformsign] 열람 알림 발송 응답:', response.status, resText);

        if (!response.ok) {
            return { success: false, error: `${response.status}: ${resText}` };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Create Document and Send SMS (Aligned with Postman JSON structure)
 */
export async function createEformsignDocument(data: any) {
    try {
        const token = await getEformsignToken();
        const today = new Date().toISOString().split('T')[0];
        const cleanPhone = (data.phone || '').replace(/\D/g, '');

        // Select the appropriate template ID based on the product
        const templateId = data.product === '더좋은크루즈'
            ? EFORMSIGN_TEMPLATE_ID_BETTER
            : EFORMSIGN_TEMPLATE_ID_Hybrid698;

        console.log(`Creating e-FormSign document for ${data.product} using template ${templateId}`);

        // Map UI data to the specific Field IDs
        const fields = [
            { id: '상품명', value: data.product },
            { id: '제품명', value: data.productName },
            { id: '구좌수', value: `${data.productCount}구좌` },
            { id: '계약자이름', value: data.name },
            { id: '주민번호', value: data.residentId },
            { id: '성별', value: data.gender || '남' },
            { id: '주소', value: `${data.address} ${data.addressDetail || ''}`.trim() },
            { id: '휴대폰', value: data.phone },
            { id: '결제방법', value: data.paymentMethod === 'card' ? '카드' : 'CMS(계좌)' },
            { id: '카드/은행명', value: data.paymentMethod === 'card' ? (data.paymentInfo?.cardCompany || '') : (data.paymentInfo?.bankName || '') },
            { id: '카드번호/계좌번호', value: data.paymentMethod === 'card' ? (data.paymentInfo?.cardNumber || '') : (data.paymentInfo?.accountNumber || '') },
            { id: '유효기간', value: (data.paymentMethod === 'card' && data.paymentInfo?.cardExpiry) ? data.paymentInfo.cardExpiry : '-' },
            { id: '이체일', value: `${data.paymentDate || '05'}일` },
            { id: '상품내용고지', value: data.agreement?.product_notice ? '1' : '' },
            { id: '개인정보수집', value: data.agreement?.privacy ? '1' : '' },
            { id: '제3자제공', value: data.agreement?.third_party ? '1' : '' },
            { id: '마케팅정보제공', value: data.agreement?.marketing ? '1' : '' },
            { id: '서명', value: data.signature || '' },
            { id: '계약일', value: today },
            { id: '계약자', value: data.name },
            { id: '영업자소속', value: data.salesAffiliation || '' },
            { id: '영업자성명', value: data.salesName || '' },
            { id: '영업자연락처', value: data.salesPhone || '' }
        ];

        // title 생략 → Error 400010 방지 (템플릿 제목 규칙 사용)
        const payload: any = {
            document: {
                comment: "가입 신청이 완료되어 서명된 신청서를 보내드립니다.",
                notification: {
                    use_mail: true,
                    use_sms: true
                },
                recipients: [
                    {
                        step_type: "07", // Distribution type
                        name: data.name,
                        use_sms: true,
                        use_mail: true,
                        send_notification: true,
                        notification_type: "01",
                        sms: {
                            country_code: "+82",
                            phone_number: cleanPhone
                        }
                    }
                ],
                fields: fields,
                select_group_name: ""
            }
        };

        const response = await fetch(`${EFORMSIGN_KR_SERVER}/v2.0/api/documents?template_id=${templateId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('--- e-FormSign API Error State ---');
            console.error('Status:', response.status);
            console.error('Response Body:', errorBody);
            console.error('Sent Payload Fields:', JSON.stringify(fields, null, 2));
            throw new Error(`e-FormSign Doc Error (${response.status}): ${errorBody}`);
        }

        const result = await response.json();
        console.log('e-FormSign Document Created Successfully:', result.document?.document_id);
        
        return {
            success: true,
            document_id: result.document?.document_id || 'unknown',
            message: '전자 서명이 성공적으로 전송되었습니다.'
        };
    } catch (error: any) {
        console.error('e-FormSign Integration Error:', error);
        return {
            success: false,
            message: error.message || '이폼사인 연동 실패'
        };
    }
}
