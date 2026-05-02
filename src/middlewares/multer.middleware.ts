import multer from 'multer';
import path from 'node:path';

const storage = multer.diskStorage({
      destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../../uploads'));
      },
      filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      },
});

export const upload = multer({
      storage: storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
            const allowedExtensions = new Set(['.jpeg', '.jpg', '.pdf', '.png', '.mp4', '.avi', '.mov', '.avif', '.webp', '.doc', '.docx', '.mp3', '.mpeg', '.wav', '.m4a', '.xls', '.xlsx', '.csv', '.ppt', '.pptx']);
            const allowedMimeTypes = new Set([
                  'image/jpeg',
                  'image/png',
                  'application/pdf',
                  'video/mp4',
                  'video/x-msvideo',
                  'video/quicktime',
                  'image/avif',
                  'image/webp',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'audio/mpeg',
                  'audio/wav',
                  'audio/mp4',
                  'application/vnd.ms-excel',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'text/csv',
                  'application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ]);
            const mimetype = allowedMimeTypes.has(file.mimetype);
            const extname = allowedExtensions.has(path.extname(file.originalname).toLowerCase());

            if (mimetype && extname) {
                  return cb(null, true);
            }
            cb(new Error('Only supported files (images, documents, spreadsheets, csv) are allowed'));
      },
});
