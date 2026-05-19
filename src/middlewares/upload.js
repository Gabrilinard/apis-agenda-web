const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const cleanFileName = String(file.originalname || 'arquivo').replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, Date.now() + '-' + cleanFileName);
  }
});

const upload = multer({ storage });

module.exports = {
  upload
};

