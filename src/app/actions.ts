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
        '상품명': data.product || '하이브리드698',
        '성함': data.name,
        '연락처': data.phone,
        '주소': `${data.address} ${data.addressDetail}`,
        '이메일': data.email,
        '사원정보': data.employeeInfo,
        '생년월일': data.residentId,
        '성별': data.gender === '1' ? '남' : '여',
        'document_id': eformResult.document_id,
        '상태': '신청완료'
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
