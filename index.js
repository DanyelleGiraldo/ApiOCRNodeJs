const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-poppler');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 1024 * 1024 * 10 } 
});

async function processImage(imagePath) {
  console.log(`Procesando imagen: ${imagePath}`);
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'spa', 
      { logger: () => {} } 
    );
    return text;
  } catch (err) {
    console.error('Error procesando la imagen:', err);
    return 'Error procesando la imagen';
  }
}

async function convertPdfToImages(pdfPath) {
  const outputDir = './uploads';
  const options = {
    format: 'png', 
    out_dir: outputDir,
    out_prefix: path.parse(pdfPath).name,
    page: null 
  };

  try {
    await pdf.convert(pdfPath, options);
    const images = await fs.readdir(outputDir);
    return images
      .filter(file => file.startsWith(path.parse(pdfPath).name) && file.endsWith('.png')) 
      .map(file => path.join(outputDir, file));
  } catch (error) {
    console.error('Error al convertir PDF a imágenes:', error);
    throw error;
  }
}

async function processPdf(pdfPath) {
  try {
    const imagePaths = await convertPdfToImages(pdfPath);
    let fullText = ''; 

    for (const imagePath of imagePaths) {
      const text = await processImage(imagePath);
      fullText += text + '\n';
    }

    console.log(fullText.trim());
    return fullText.trim(); 
  } catch (err) {
    console.error('Error procesando el PDF:', err);
    return 'Error procesando el PDF';
  }
}

app.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Error al subir el archivo:', err);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Error de Multer: ' + err.message });
      }
      return res.status(500).json({ error: 'Error desconocido: ' + err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();

    try {
      let result;
      if (fileExt === '.pdf') {
        result = await processPdf(req.file.path); 
      } else {
        result = await processImage(req.file.path);
      }

      return res.json({ text: result });
    } catch (error) {
      return res.status(500).json({ error: 'Error al procesar el archivo.' });
    }
  });
});

app.listen(3000, () => {
  console.log('Servidor en funcionamiento en http://localhost:3000');
});
