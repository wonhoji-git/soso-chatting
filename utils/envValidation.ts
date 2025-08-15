// 환경변수 검증 및 보안 유틸리티

interface EnvConfig {
  // Pusher 설정
  NEXT_PUBLIC_PUSHER_KEY: string;
  NEXT_PUBLIC_PUSHER_CLUSTER: string;
  PUSHER_APP_ID: string;
  PUSHER_SECRET: string;
  
  // VAPID 설정
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  
  // Next.js 환경
  NODE_ENV: string;
  VERCEL_URL?: string;
}

class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: Partial<EnvConfig> = {};
  private isValid = false;

  private constructor() {
    this.loadConfig();
    this.validate();
  }

  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  private loadConfig(): void {
    this.config = {
      // Pusher 설정
      NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
      NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      PUSHER_APP_ID: process.env.PUSHER_APP_ID,
      PUSHER_SECRET: process.env.PUSHER_SECRET,
      
      // VAPID 설정
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT,
      
      // Next.js 환경
      NODE_ENV: process.env.NODE_ENV || 'development',
      VERCEL_URL: process.env.VERCEL_URL,
    };
  }

  private validate(): void {
    const errors: string[] = [];

    // 필수 환경변수 검증
    const requiredVars: (keyof EnvConfig)[] = [
      'NEXT_PUBLIC_PUSHER_KEY',
      'NEXT_PUBLIC_PUSHER_CLUSTER', 
      'PUSHER_APP_ID',
      'PUSHER_SECRET',
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT'
    ];

    for (const varName of requiredVars) {
      const value = this.config[varName];
      if (!value || value.trim() === '') {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // VAPID 키 형식 검증
    if (this.config.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      if (!this.isValidVapidKey(this.config.NEXT_PUBLIC_VAPID_PUBLIC_KEY)) {
        errors.push('Invalid VAPID public key format');
      }
    }

    if (this.config.VAPID_PRIVATE_KEY) {
      if (!this.isValidVapidKey(this.config.VAPID_PRIVATE_KEY)) {
        errors.push('Invalid VAPID private key format');
      }
    }

    // VAPID subject 형식 검증
    if (this.config.VAPID_SUBJECT) {
      if (!this.config.VAPID_SUBJECT.startsWith('mailto:') && !this.config.VAPID_SUBJECT.startsWith('https://')) {
        errors.push('VAPID subject must be a mailto: or https: URL');
      }
    }

    if (errors.length > 0) {
      console.error('❌ Environment validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      this.isValid = false;
    } else {
      console.log('✅ Environment validation passed');
      this.isValid = true;
    }
  }

  private isValidVapidKey(key: string): boolean {
    // VAPID 키는 base64url 인코딩된 형태여야 함
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    return base64urlPattern.test(key) && key.length >= 43;
  }

  isValidEnvironment(): boolean {
    return this.isValid;
  }

  getConfig(): Partial<EnvConfig> {
    return { ...this.config };
  }

  getPublicConfig() {
    return {
      NEXT_PUBLIC_PUSHER_KEY: this.config.NEXT_PUBLIC_PUSHER_KEY,
      NEXT_PUBLIC_PUSHER_CLUSTER: this.config.NEXT_PUBLIC_PUSHER_CLUSTER,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: this.config.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      NODE_ENV: this.config.NODE_ENV,
      IS_VERCEL: !!this.config.VERCEL_URL,
    };
  }

  // 보안을 위한 마스킹된 설정 반환
  getMaskedConfig() {
    const mask = (str: string = '') => {
      if (str.length <= 8) return '*'.repeat(str.length);
      return str.substring(0, 4) + '*'.repeat(str.length - 8) + str.substring(str.length - 4);
    };

    return {
      NEXT_PUBLIC_PUSHER_KEY: this.config.NEXT_PUBLIC_PUSHER_KEY, // 퍼블릭이므로 마스킹 안함
      NEXT_PUBLIC_PUSHER_CLUSTER: this.config.NEXT_PUBLIC_PUSHER_CLUSTER,
      PUSHER_APP_ID: mask(this.config.PUSHER_APP_ID),
      PUSHER_SECRET: mask(this.config.PUSHER_SECRET),
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: this.config.NEXT_PUBLIC_VAPID_PUBLIC_KEY, // 퍼블릭이므로 마스킹 안함
      VAPID_PRIVATE_KEY: mask(this.config.VAPID_PRIVATE_KEY),
      VAPID_SUBJECT: this.config.VAPID_SUBJECT,
      NODE_ENV: this.config.NODE_ENV,
      VERCEL_URL: this.config.VERCEL_URL ? 'https://****' : undefined,
    };
  }

  // 개발 모드에서만 사용하는 디버그 정보
  getDebugInfo() {
    if (this.config.NODE_ENV === 'production') {
      return { message: 'Debug info not available in production' };
    }

    return {
      isValid: this.isValid,
      config: this.getMaskedConfig(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }
}

// 싱글톤 인스턴스 export
export const envValidator = EnvironmentValidator.getInstance();

// 편의 함수들
export function validateEnvironment(): boolean {
  return envValidator.isValidEnvironment();
}

export function getPublicEnvConfig() {
  return envValidator.getPublicConfig();
}

export function getMaskedEnvConfig() {
  return envValidator.getMaskedConfig();
}

export function getEnvDebugInfo() {
  return envValidator.getDebugInfo();
}