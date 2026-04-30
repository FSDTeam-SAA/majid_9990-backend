import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import config from '../config/config';

cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
});

export const uploadToCloudinary = async (localFilePath: string) => {
      try {
            if (!localFilePath) return null;

            const response = await cloudinary.uploader.upload(localFilePath, {
                  resource_type: 'auto',
            });

            // Remove file from local storage after upload
            fs.unlinkSync(localFilePath);

            return response;
      } catch (error) {
            // Remove file from local storage if upload fails
            if (fs.existsSync(localFilePath)) {
                  fs.unlinkSync(localFilePath);
            }
            return null;
      }
};

export const uploadVideoToCloudinary = async (filePath: string, folder: string) => {
      try {
            const result = await cloudinary.uploader.upload(filePath, {
                  folder,
                  resource_type: 'video',
                  chunk_size: 9000000,
            });

            fs.unlinkSync(filePath);

            return {
                  public_id: result.public_id,
                  secure_url: result.secure_url,
                  duration: result.duration,
                  format: result.format,
            };
      } catch (error: any) {
            console.error('Error uploading video to Cloudinary:', error);
            throw new Error('Failed to upload video to Cloudinary');
      }
};

// /

export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') => {
      try {
            await cloudinary.uploader.destroy(publicId, {
                  resource_type: resourceType,
            });
      } catch (error) {
            throw new Error('Failed to delete file from Cloudinary');
      }
};