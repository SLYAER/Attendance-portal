import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const getGmailTokenAndUser = async (): Promise<{ user: User; accessToken: string }> => {
  if (cachedAccessToken && cachedUser) {
    return { user: cachedUser, accessToken: cachedAccessToken };
  }

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (!credential?.accessToken) {
    throw new Error('Failed to get access token from Firebase Auth');
  }

  cachedAccessToken = credential.accessToken;
  cachedUser = result.user;
  
  return { user: cachedUser, accessToken: cachedAccessToken };
};

export const sendGmailMessage = async (accessToken: string, to: string, subject: string, body: string) => {
  const emailContent = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ].join('\r\n');
  
  const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error: ${err}`);
  }
  
  return await res.json();
};
