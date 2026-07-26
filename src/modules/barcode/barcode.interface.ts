export interface IBarcodeSearchResult {
      name: string;
      brand?: string;
      category?: string;
      description?: string;
      color?: string;
      size?: string;
      barcode: string;
      image?: string;
      images?: string[];
      rawData?: any;
}

export interface IEANSearchAPIResponse {
      status: number;
      product?: {
            name?: string;
            brand?: string;
            category?: string;
            description?: string;
            image?: string;
            ean?: string;
            [key: string]: any;
      };
      message?: string;
}

export interface ICacheEntry {
      data: IBarcodeSearchResult;
      timestamp: number;
}

export type TSearchType = 'barcode' | 'name';
