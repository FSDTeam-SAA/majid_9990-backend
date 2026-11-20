import { Document, Types } from 'mongoose';

export type TSourceStatus =
      | 'preloaded'
      | 'source-listed'
      | 'original-source-review'
      | 'external-api'
      | 'user-verified'
      | 'marketplace-listed'
      | 'retailer-listed'
      | 'review';

export interface IMasterCatalogue {
      _id?: Types.ObjectId;
      rowId?: string;
      deviceName: string;
      model: string;
      brand: string;
      category?: string;
      year?: number;
      storage?: string;
      colour?: string;
      connectivity?: string;
      glass?: string;
      modelNumber?: string;
      partNumber?: string;
      partBase?: string;
      upc?: string;
      ean?: string;
      gtin14?: string;
      barcode: string; // primary normalized barcode for fast lookup
      sku?: string;
      imageUrl?: string;
      imageKey?: string;
      sourceStatus?: TSourceStatus | string;
      sourceUrl?: string;
      autoFillApproved?: boolean;
      sources?: string[];
      market?: string;
      specs?: Record<string, any>;
      isActive?: boolean;
      createdAt?: Date;
      updatedAt?: Date;
}

export type IMasterCatalogueDocument = IMasterCatalogue;

export interface ICatalogueSearchParams {
      query?: string;
      brand?: string;
      category?: string;
      model?: string;
      storage?: string;
      colour?: string;
      autoFillApproved?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
}

export interface ICatalogueSearchResult {
      results: IMasterCatalogue[];
      pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
      };
}
