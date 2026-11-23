export interface ITradeInGrade {
      name: string;
      price: number;
      weeklyChange: number;
      trend: 'up' | 'down' | 'none';
      weeklyChangeSigned?: number;
}

export interface ITradeInCatalogItem {
      id: string;
      brand: string;
      category: string;
      deviceName: string;
      modelNumber: string;
      storage: string;
      color: string;
      upc?: string;
      ean?: string;
      imageUrl?: string;
      grades: {
            A: ITradeInGrade;
            B: ITradeInGrade;
            C: ITradeInGrade;
      };
      lastUpdated: string;
      source: string;
}

export interface ITradeInSearchParams {
      query?: string;
      category?: string;
      page?: number;
      limit?: number;
}

export interface ITradeInSearchResult {
      items: ITradeInCatalogItem[];
      pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
      };
}
