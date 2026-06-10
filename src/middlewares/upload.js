const fs = require('fs');
const path = require('path');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const USE_S3 = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_BUCKET);

let upload;

if (USE_S3) {
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });

  upload = multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET,
      key: (req, file, cb) => {
        const cleanFileName = String(file.originalname || 'arquivo').replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `uploads/${Date.now()}-${cleanFileName}`);
      },
    }),
  });
} else {
  // fallback: disco local (desenvolvimento sem S3 configurado)
  const uploadsDir = path.join(__dirname, '../../uploads');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const cleanFileName = String(file.originalname || 'arquivo').replace(/[^a-zA-Z0-9.]/g, '_');
      cb(null, Date.now() + '-' + cleanFileName);
    },
  });
  upload = multer({ storage });
}

module.exports = { upload, USE_S3 };
