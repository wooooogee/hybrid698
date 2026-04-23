'use server';

import { createEformsignDocument, sendViewerNotification } from '@/lib/eformsign';

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

    console.log('문서 생성 완료, document_id:', eformResult.document_id);

    // 문서 생성 직후 계약자(열람자)에게 이폼사인 자체 열람 알림 발송
    // 웹훅(doc_complete)을 기다리지 않고 즉시 발송 — 템플릿 배포 단계 유무와 무관하게 동작
    if (eformResult.document_id && eformResult.document_id !== 'unknown') {
      const notifyResult = await sendViewerNotification(
        eformResult.document_id,
        data.name,
        (data.phone || '').replace(/\D/g, '')
      );
      if (notifyResult.success) {
        console.log('열람 알림 발송 완료 →', data.name, data.phone);
      } else {
        console.error('열람 알림 발송 실패:', notifyResult.error);
      }
    }

    console.log('--- Register Action Completed ---');
    return {
      success: true,
      message: '가입 신청 및 전자 서명이 완료되었습니다.',
    };
  } catch (error: any) {
    console.error('--- Register Action Fatal Error ---', error);
    return { success: false, message: error.message || '등록 중 오류가 발생했습니다.' };
  }
}
