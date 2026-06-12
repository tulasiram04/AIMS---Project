import { reportsAPI } from './api';

/**
 * Centralized service to handle download of PDF reports.
 * Used by ReportsPage, ReconciliationPage, and Audit deep-link redirects.
 * Logs response details, validates PDF signature, and maps UUID storage names to business names.
 */
export async function downloadReportFile(reportId: number): Promise<boolean> {
  try {
    const res = await reportsAPI.download(reportId);

    // Task 6: Log response headers and blob type in browser console
    console.log('--- AIMS PDF Download Log ---');
    console.log('Response Headers:', res.headers);
    console.log('Response Data Blob Type:', res.data instanceof Blob ? res.data.type : typeof res.data);
    if (res.data instanceof Blob) {
      console.log('Response Data Blob Size:', res.data.size, 'bytes');
    }

    // Task 7: If backend returns UUID storage names, map them to business names before download.
    // Check filename in Content-Disposition header
    const contentDisposition = res.headers ? res.headers['content-disposition'] : undefined;
    let filename = `AIMS_Report_${reportId}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
        console.log('Filename from Content-Disposition header:', filename);
      }
    }

    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    if (uuidRegex.test(filename)) {
      console.log('UUID detected in filename. Mapping to business name.');
      filename = `AIMS_Report_${reportId}.pdf`;
    }

    // Task 5: Force download filename: AIMS_Report_<REPORT_ID>.pdf
    filename = `AIMS_Report_${reportId}.pdf`;
    console.log('Final target filename for download:', filename);

    // Make sure res.data is handled as a Blob
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });

    // Task 8: Validate generated file begins with %PDF and opens correctly.
    // We read the first 4 bytes of the blob to verify the PDF magic number (%PDF).
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer).subarray(0, 4);
      let header = '';
      for (let i = 0; i < arr.length; i++) {
        header += String.fromCharCode(arr[i]);
      }
      console.log('Validated PDF Signature (first 4 bytes):', header);
      if (header !== '%PDF') {
        console.error('ERROR: Downloaded file is invalid. Does not start with %PDF signature!');
      } else {
        console.log('SUCCESS: Verified PDF signature begins with %PDF.');
      }
    };
    reader.readAsArrayBuffer(blob.slice(0, 4));

    // Create a temporary Object URL for the blob
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);

    // Append, click and cleanup
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 10000);

    return true;
  } catch (error) {
    console.error('Error occurred in shared downloadReportFile service:', error);
    throw error;
  }
}
