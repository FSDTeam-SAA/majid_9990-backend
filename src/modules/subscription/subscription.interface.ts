export interface IPrice {
      amount?: number;
      min?: number;
      max?: number;
      currency: string;
}

export interface IDiscountTier {
      tier: 'bronze' | 'silver' | 'diamond';
      percentage: number;
}

export interface ISubscription {
      title: string;
      badge: string;
      price: IPrice;
      billingModel: string;
      features: string[];
      discount?: IDiscountTier[];
}
