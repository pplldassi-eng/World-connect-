// src/lib/agora.ts
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || "";

if (!APP_ID) {
  console.warn("VITE_AGORA_APP_ID n'est pas configuré dans les variables d'environnement.");
}

export const requestPermissionsOnce = async () => {
  const alreadyAsked = localStorage.getItem('wc_permissions_asked');
  if (alreadyAsked === 'true') return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach(track => track.stop());
    localStorage.setItem('wc_permissions_asked', 'true');
    return true;
  } catch (error) {
    console.warn("Permissions non accordées au démarrage", error);
    return false;
  }
};

class AgoraService {
  private client: IAgoraRTCClient;
  public localAudioTrack: IMicrophoneAudioTrack | null = null;
  public localVideoTrack: ICameraVideoTrack | null = null;
  public remoteVideoTrack: any = null;
  private remoteUsers: { [uid: number | string]: any } = {};
  public isSimulated = false;
  private trackListeners: Set<(event: string) => void> = new Set();

  constructor() {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.setupListeners();
  }

  public subscribeTracks(listener: (event: string) => void) {
    this.trackListeners.add(listener);
    return () => {
      this.trackListeners.delete(listener);
    };
  }

  private notifyTrackChange(event: string) {
    this.trackListeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error("Error in track listener:", e);
      }
    });
  }

  private setupListeners() {
    // 1. QUAND QUELQU'UN PUBLIE
    this.client.on('user-published', async (user, mediaType) => {
      this.remoteUsers[user.uid] = user;
      try {
        await this.client.subscribe(user, mediaType);
        
        if (mediaType === 'video' && user.videoTrack) {
          this.remoteVideoTrack = user.videoTrack;
          this.notifyTrackChange('remote-video-published');
        }
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
      } catch (err) {
        console.error("Erreur subscribe:", err);
      }
    });

    // 2. QUAND QUELQU'UN QUITTE OU UNPUBLISH
    this.client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        if (this.remoteVideoTrack === user.videoTrack) {
          this.remoteVideoTrack = null;
        }
        this.notifyTrackChange('remote-video-unpublished');
      }
    });

    this.client.on('user-left', (user) => {
      delete this.remoteUsers[user.uid];
      if (this.remoteVideoTrack === user.videoTrack) {
        this.remoteVideoTrack = null;
      }
      this.notifyTrackChange('remote-video-left');
    });
  }

  async joinAndPublish(channelName: string, type: 'audio' | 'video', uid?: string | number | null) {
    if (!APP_ID) {
      throw new Error("VITE_AGORA_APP_ID manquant");
    }

    // 1. Créer les tracks une seule fois avec AEC, AGC, ANS
    try {
      if (type === 'video' && (!this.localAudioTrack || !this.localVideoTrack)) {
        [this.localAudioTrack, this.localVideoTrack] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack({ AEC: true, AGC: true, ANS: true }),
          AgoraRTC.createCameraVideoTrack({ encoderConfig: '480p_2' })
        ]);
        this.notifyTrackChange('local-tracks-created');
      } else if (type === 'audio' && !this.localAudioTrack) {
        this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, AGC: true, ANS: true });
        this.notifyTrackChange('local-tracks-created');
      }
    } catch (err) {
      console.warn("Périphérique physique non disponible, mode simulation non implémenté dans le refactor", err);
      throw err;
    }
    
    // 2. Join
    await this.client.join(APP_ID, channelName, null, uid || null);
    
    // 3. Publish
    const tracksToPublish = [];
    if (this.localAudioTrack) tracksToPublish.push(this.localAudioTrack);
    if (this.localVideoTrack && type === 'video') tracksToPublish.push(this.localVideoTrack);
    
    if (tracksToPublish.length > 0) {
      await this.client.publish(tracksToPublish);
    }
  }

  playLocalVideo(elementId: string = 'local-player') {
    if (this.localVideoTrack) {
      const el = document.getElementById(elementId);
      if (el) {
        this.localVideoTrack.play(elementId);
      }
    }
  }

  async leave() {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.localVideoTrack) {
      this.localVideoTrack.stop();
      this.localVideoTrack.close();
      this.localVideoTrack = null;
    }
    this.remoteVideoTrack = null;
    this.remoteUsers = {};
    await this.client.leave();
    this.notifyTrackChange('tracks-cleared');
  }

  async toggleMic(enabled: boolean) {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(enabled);
      return enabled;
    }
    return false;
  }

  async toggleCamera(enabled: boolean) {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(enabled);
      return enabled;
    }
    return false;
  }
}

export const agoraService = new AgoraService();

