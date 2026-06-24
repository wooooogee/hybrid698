'use server';

import { createEformsignDocument } from '@/lib/eformsign';
import { addRegistrationToSheet } from '@/lib/googleSheets';

export async function registerAction(data: any) {
  try {
    console.log('--- Register Action Started ---');

    const eformResult = await createEformsignDocument(data);

    if (!eformResult.success) {
      return {
        success: false,
        message: '이폼사인 전송 중 오류가 발생했습니다: ' + eformResult.message,
      };
    }

    // Google Sheets에 데이터 기록
    try {
      const formatHealthcareTarget = (target: any) => {
        if (!target || !target.name) return '';
        const { name, birth, gender, phone } = target;
        let formattedBirth = birth || '';
        if (birth && birth.length === 6) {
          const year = parseInt(birth.substring(0, 2));
          const yearPrefix = year >= 40 ? '19' : '20';
          const fullBirth = yearPrefix + birth;
          let genderDigit = '';
          if (gender === '남') genderDigit = yearPrefix === '19' ? '1' : '3';
          else if (gender === '여') genderDigit = yearPrefix === '19' ? '2' : '4';
          formattedBirth = genderDigit ? `${fullBirth}-${genderDigit}` : fullBirth;
        }
        return `${name} ${formattedBirth} ${phone || ''}`.trim();
      };

      const sheetData = {
        '신청일시': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        '상품명': data.product || '더좋은하이브리드698',
        '계약자': data.name,
        '연락처': data.phone,
        '주소': `${data.address} ${data.addressDetail || ''}`.trim(),
        '제품명': data.productName || '',
        '구좌수': data.productCount,
        '결제정보(카드/cms)': data.paymentMethod === 'card' ? '카드' : 'CMS',
        '카드사/은행명': data.paymentMethod === 'card' ? (data.paymentInfo?.cardCompany || '') : (data.paymentInfo?.bankName || ''),
        '카드번호/계좌번호': data.paymentMethod === 'card' ? (data.paymentInfo?.cardNumber || '') : (data.paymentInfo?.accountNumber || ''),
        '유효기간': (data.paymentMethod === 'card' && data.paymentInfo?.cardExpiry) ? data.paymentInfo.cardExpiry : '',
        '결제일': data.paymentDate || '05',
        '영업자소속': data.salesAffiliation || '',
        '영업자': data.salesName || '',
        '영업자연락처': data.salesPhone || '',
        'document_id': eformResult.document_id,
        '상태': '신청완료',
        '대상자1': formatHealthcareTarget(data.healthcareTargets?.[0]),
        '대상자2': formatHealthcareTarget(data.healthcareTargets?.[1]),
        '대상자3': formatHealthcareTarget(data.healthcareTargets?.[2]),
        '대상자4': formatHealthcareTarget(data.healthcareTargets?.[3]),
      };
      
      let sheetName = '굿라이프헬스케어';
      if (data.product === '더좋은프리미엄540') {
        sheetName = '프리미엄540';
      } else if (data.product === '더좋은하이브리드698') {
        sheetName = '하이브리드698';
      } else if (data.product === '더좋은크루즈') {
        sheetName = '크루즈';
      }
      const sheetResult = await addRegistrationToSheet(sheetData, sheetName);
      
      if (sheetResult.success) {
        console.log(`Google Sheets 기록 완료 (${sheetName} 시트), 행 번호: ${sheetResult.rowNumber}`);
      } else {
        console.error('Google Sheets 기록 실패:', sheetResult.error);
        // 필요 시 여기서 추가적인 처리를 할 수 있습니다.
      }
    } catch (sheetError) {
      console.error('Google Sheets 기록 중 예외 발생:', sheetError);
    }

    console.log('문서 생성 완료, document_id:', eformResult.document_id);
    console.log('--- Register Action Completed ---');

    return {
      success: true,
      documentId: eformResult.document_id,
      message: '가입 신청 및 전자 서명이 완료되었습니다.',
    };
  } catch (error: any) {
    console.error('--- Register Action Fatal Error ---', error);
    return { success: false, message: error.message || '등록 중 오류가 발생했습니다.' };
  }
}
