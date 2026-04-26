// export interface IPrice {
//       amount?: number;
//       min?: number;
//       max?: number;
//       currency: string;
// }

// export interface IDiscountTier {
//       tier: 'bronze' | 'silver' | 'diamond';
//       percentage: number;
// }

// export interface ISubscription {
//       title: string;
//       badge: string;
//       price: IPrice;
//       billingModel: string;
//       features: string[];
//       discount?: IDiscountTier[];
//       isFree: boolean;
// }

export type PlanType = 'STARTER' | 'PAY AS YOU GO' | 'DIAMOND' | 'ENTERPRISE';

export interface IPlanFeature {
      name: string;
      included: boolean;
}

export interface ISubscription {
      name: string;
      type: PlanType;
      price: number;
      priceLabel: string;
      description: string;
      features: IPlanFeature[];
      isPopular?: boolean;
      discount?: number;
      apiAccess?: boolean;
      customPricing?: boolean;
      ctaText: string;
      isAvailable: boolean;
}
