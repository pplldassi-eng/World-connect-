import imageCompression from 'browser-image-compression';

/**
 * Compresse une image côté client (max 1MB, maxWidth 1280px)
 */
export const compressImageFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], file.name, {
      type: file.type || 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Erreur lors de la compression de l'image:", error);
    return file; // En cas d'erreur, on retourne le fichier original
  }
};

/**
 * Vérifie la durée d'un fichier audio (max 2 minutes = 120s)
 */
export const validateAudioDuration = (file: File | Blob): Promise<boolean> => {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    audio.onloadedmetadata = () => {
      window.URL.revokeObjectURL(audio.src);
      resolve(audio.duration <= 121); // 120s + 1s de marge
    };

    audio.onerror = () => {
      resolve(false);
    };

    audio.src = URL.createObjectURL(file);
  });
};

/**
 * Vérifie la taille d'un fichier vidéo (max 15MB)
 */
export const validateVideoFile = (file: File): boolean => {
  const maxSize = 15 * 1024 * 1024; // 15MB
  return file.size <= maxSize;
};

/**
 * Vérifie la durée d'une vidéo (max 15s)
 */
export const validateVideoDuration = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration <= 16); // 15s + 1s de marge
    };

    video.onerror = () => {
      resolve(false);
    };

    video.src = URL.createObjectURL(file);
  });
};

