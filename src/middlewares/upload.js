const fs = require('fs');
const path = require('path');
const multer = require('multer');
const multerS3 = require('multer-s3');
const jwt = require('jsonwebtoken');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

const USE_S3 = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_BUCKET);

let upload;
let s3;

if (USE_S3) {
  s3 = new S3Client({
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

const extractS3Key = (stored) => {
  if (!/^https?:\/\//.test(stored)) return stored;
  try {
    const url = new URL(stored);
    const bucket = process.env.S3_BUCKET;
    const prefix = `/${bucket}/`;
    return url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname.replace(/^\//, '');
  } catch {
    return stored;
  }
};

// Assina um acesso de curta duração (5 min) ao arquivo local, no mesmo espírito da
// URL pré-assinada do S3: o token prova que quem gerou o link já passou pela checagem
// de posse (feita antes de chamar getFileUrl nas views), sem exigir que o <a href>
// do front-end envie um cabeçalho Authorization — algo que uma tag <a> comum não faz.
const signLocalFileToken = (filename) =>
  jwt.sign({ file: filename }, config.jwtSecret, { expiresIn: '5m' });

const getFileUrl = async (stored) => {
  if (!stored) return null;
  if (USE_S3) {
    const key = extractS3Key(stored);
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }), { expiresIn: 300 });
  }
  const filename = path.basename(stored);
  const token = signLocalFileToken(filename);
  return `/uploads/${filename}?token=${token}`;
};

module.exports = { upload, USE_S3, getFileUrl };
