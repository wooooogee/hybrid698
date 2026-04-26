import { NextRequest, NextResponse } from 'next/server';
import { getEformsignToken } from '@/lib/eformsign';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return new NextResponse('Document ID is required', { status: 400 });
    }

    const token = await getEformsignToken();
    const EFORMSIGN_KR_SERVER = 'https://kr-api.eformsign.com';

    let response: Response | null = null;
    let attempts = 0;
    // PDF 생성에 시간이 걸릴 수 있으므로 404/400 발생 시 최대 7번 재시도 (약 20초)
    const maxAttempts = 7;
    const endpoints = [
      `${EFORMSIGN_KR_SERVER}/v2.0/api/documents/${documentId}/download_files?file_type=document`,
      `${EFORMSIGN_KR_SERVER}/v2.0/api/documents/${documentId}/pdf`
    ];

    while (attempts < maxAttempts) {
      console.log(`[eformsign] Download Attempt ${attempts + 1} for document ${documentId}...`);
      
      // Try endpoints sequentially
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            console.log(`[eformsign] Download success on attempt ${attempts + 1} using ${endpoint.includes('download_files') ? 'download_files' : 'pdf'} endpoint`);
            break;
          }
        } catch (fetchErr) {
          console.error(`[eformsign] Fetch error on endpoint ${endpoint}:`, fetchErr);
        }
      }

      if (response && response.ok) break;

      const errText = response ? await response.text() : 'No response';
      console.log(`[eformsign] PDF Download Attempt ${attempts + 1} failed: Status ${response?.status} - ${errText}`);

      let shouldRetry = false;
      if (!response || response.status === 404 || response.status === 423) {
        shouldRetry = true;
      } else if (response.status === 400) {
        try {
          const errObj = JSON.parse(errText);
          // 2020001: PDF is being generated
          if (errObj.code === '2020001') {
            shouldRetry = true;
          }
        } catch (e) {}
      }

      if (shouldRetry) {
        attempts++;
        if (attempts < maxAttempts) {
          const delay = 3000;
          console.log(`[eformsign] Waiting ${delay/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return new NextResponse(`Error downloading PDF: ${response?.status} (${errText})`, { status: response?.status || 500 });
    }

    if (!response || !response.ok) {
      return new NextResponse('Failed to retrieve PDF after retries', { status: 404 });
    }

    // Pass the PDF buffer directly to the client
    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=contract.pdf',
        'X-Content-Type-Options': 'nosniff',
      }
    });
  } catch (error: any) {
    console.error('Download API Route Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
