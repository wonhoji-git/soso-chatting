const webpush = require('web-push');

console.log('🔐 Generating VAPID keys for PWA push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('📋 Copy these VAPID keys to your .env.local file:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ VAPID keys generated successfully!');
console.log('📝 Make sure to add these to your .env.local file for push notifications to work.');