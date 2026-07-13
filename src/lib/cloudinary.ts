// src/lib/cloudinary.ts

/**
 * Interface pour les options de retour de Cloudinary
 */
export interface CloudinaryUploadResult {
  url: string;
  type: 'image' | 'video' | 'audio' | 'raw';
}

/**
 * Envoie un fichier vers Cloudinary en mode Unsigned
 * @param file Le fichier à uploader (image, audio, vidéo)
 * @param onProgress Callback pour la barre de progression (0 à 100)
 * @returns { url, type }
 */
export const uploadToCloudinary = (
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    // Configuration demandée par l'utilisateur avec prise en charge des variables d'environnement
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'sole';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'worldconnect-v2_non';

    // Détermination dynamique du type de ressource pour l'URL de téléversement Cloudinary
    let resourceType = 'raw';
    if (file.type.startsWith('image/')) {
      resourceType = 'image';
    } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      resourceType = 'video';
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    // Suivi de la progression
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    });

    // Quand la requête est terminée
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          
          let fileType: CloudinaryUploadResult['type'] = 'raw';
          if (response.resource_type === 'image') fileType = 'image';
          else if (response.resource_type === 'video') {
            // Cloudinary classe aussi l'audio comme video, on peut vérifier le type du fichier original
            if (file.type.startsWith('audio/')) {
              fileType = 'audio';
            } else {
              fileType = 'video';
            }
          }

          resolve({
            url: response.secure_url,
            type: fileType
          });
        } catch (err) {
          reject(new Error("Réponse de Cloudinary invalide."));
        }
      } else {
        console.error("Erreur Cloudinary:", xhr.responseText);
        reject(new Error(`Upload échoué avec le statut ${xhr.status}. Vérifie ta connexion ou ton preset.`));
      }
    });

    // En cas d'erreur réseau
    xhr.addEventListener('error', () => {
      reject(new Error("Erreur réseau pendant le téléversement."));
    });

    xhr.open('POST', url, true);
    xhr.send(formData);
  });
};
