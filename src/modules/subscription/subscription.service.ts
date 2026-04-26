import { ISubscription } from './subscription.interface';
import Subscription from './subscription.model';

const createSubscription = async (payload: ISubscription) => {
      // limit total subscriptions
      const totalSubscriptions = await Subscription.countDocuments();
      if (totalSubscriptions >= 4) {
            throw new Error('You can create only 4 subscriptions');
      }

      // required fields according to new model
      if (!payload.name) {
            throw new Error('Name is required');
      }

      if (!payload.type) {
            throw new Error('Type is required');
      }

      if (payload.price === undefined || payload.price === null) {
            throw new Error('Price is required');
      }

      if (!payload.priceLabel) {
            throw new Error('Price label is required');
      }

      if (!payload.description) {
            throw new Error('Description is required');
      }

      if (!payload.ctaText) {createSubscription;
            throw new Error('CTA text is required');
      }

      // duplicate check by name
      const isExist = await Subscription.findOne({ name: payload.name });
      if (isExist) {
            throw new Error('Subscription with this name already exists');
      }

      // features default
      if (!payload.features) {
            payload.features = [];
      }

      // default flags
      if (payload.isPopular === undefined) {
            payload.isPopular = false;
      }

      if (payload.apiAccess === undefined) {
            payload.apiAccess = false;
      }

      if (payload.customPricing === undefined) {
            payload.customPricing = false;
      }

      // discount validation if provided
      if (payload.discount !== undefined && payload.discount !== null) {
            if (typeof payload.discount !== 'number') {
                  throw new Error('Discount must be a number between 0 and 100');
            }

            if (payload.discount < 0 || payload.discount > 100) {
                  throw new Error('Discount must be between 0 and 100');
            }
      }

      // create
      const result = await Subscription.create(payload);
      return result;
};

const getAllSubscriptions = async () => {
      const result = await Subscription.find();
      return result;
};

const updateSubscription = async (id: string, payload: Partial<ISubscription>) => {
      // 1️⃣ Find subscription
      const subscription = await Subscription.findById(id);

      if (!subscription) {
            throw new Error('Subscription not found');
      }

      // 2️⃣ Prevent duplicate name (if name is being updated)
      if (payload.name && payload.name !== subscription.name) {
            const isExist = await Subscription.findOne({
                  name: payload.name,
            });

            if (isExist) {
                  throw new Error('Subscription with this name already exists');
            }
      }

      // 3️⃣ Price validation (if provided)
      if (payload.price !== undefined && payload.price !== null) {
            if (typeof payload.price !== 'number' || Number.isNaN(payload.price)) {
                  throw new Error('Price must be a valid number');
            }

            if (payload.price < 0) {
                  throw new Error('Price must be >= 0');
            }
      }

      // 4️⃣ Discount validation (if provided)
      if (payload.discount !== undefined && payload.discount !== null) {
            if (typeof payload.discount !== 'number' || Number.isNaN(payload.discount)) {
                  throw new Error('Discount must be a number between 0 and 100');
            }

            if (payload.discount < 0 || payload.discount > 100) {
                  throw new Error('Discount must be between 0 and 100');
            }
      }

      // 5️⃣ Features validation (if provided)
      if (payload.features !== undefined && payload.features !== null) {
            if (!Array.isArray(payload.features)) {
                  throw new Error('Features must be an array');
            }
      }

      // 6️⃣ Update DB
      const result = await Subscription.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
      });

      return result;
};

const subscriptionService = {
      createSubscription,
      getAllSubscriptions,
      updateSubscription,
};

export default subscriptionService;
