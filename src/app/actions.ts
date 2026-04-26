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
      const sheetData = {
        '신청일시': new Date().toLocaleString('ko-KR'),
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
        '대상자1': data.healthcareTargets?.[0]?.name ? `${data.healthcareTargets[0].name} ${data.healthcareTargets[0].birth || ''} ${data.healthcareTargets[0].phone || ''}`.trim() : '',
        '대상자2': data.healthcareTargets?.[1]?.name ? `${data.healthcareTargets[1].name} ${data.healthcareTargets[1].birth || ''} ${data.healthcareTargets[1].phone || ''}`.trim() : '',
        '대상자3': data.healthcareTargets?.[2]?.name ? `${data.healthcareTargets[2].name} ${data.healthcareTargets[2].birth || ''} ${data.healthcareTargets[2].phone || ''}`.trim() : '',
        '대상자4': data.healthcareTargets?.[3]?.name ? `${data.healthcareTargets[3].name} ${data.healthcareTargets[3].birth || ''} ${data.healthcareTargets[3].phone || ''}`.trim() : '',
      };
      
      await addRegistrationToSheet(sheetData, '하이브리드698');
      console.log('Google Sheets 기록 완료 (하이브리드698 시트)');
    } catch (sheetError) {
      console.error('Google Sheets 기록 중 실패 (프로세스는 계속됨):', sheetError);
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
