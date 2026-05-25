export interface IOCRResult {
      rawText: string;
      imeiNumbers: string[];
      confidence: 'high' | 'medium' | 'low';
      processingTime: number;
}

export interface IOCRResponse {
      success: boolean;
      data: IOCRResult;
      message?: string;
}

export interface INIDResult {
      nidNumber: string | null;
      isValid: boolean;
      message: string;
      processingTime: number;
}
