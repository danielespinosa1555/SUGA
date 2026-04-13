const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia a un registro que no existe' });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Sesión expirada, inicia sesión nuevamente' });
  }
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Archivo demasiado grande. Máximo 5MB' });
    }
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res) => {
  res.status(404).json({ error: `Ruta ${req.originalUrl} no encontrada` });
};

module.exports = { errorHandler, notFound };
