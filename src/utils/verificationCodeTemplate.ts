import { companyName } from '../lib/globalType';

const verificationCodeTemplate = (code: string) => `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);">
      
      <header style="background-color: #f0f4ff; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; color: #2b3f6c;">Welcome to ${companyName}</h1>
      </header>

      <main style="padding: 30px;">
        <p style="font-size: 17px; color: #333; line-height: 1.6;">
          Hello,
        </p>
        <p style="font-size: 17px; color: #333; line-height: 1.6;">
          You requested to verify your account on <strong>${companyName}</strong>. Enter the code below to proceed:
        </p>
        <div style="text-align: center; margin: 35px 0;">
          <span style="display: inline-block; background-color: #edf2ff; color: #2b3f6c; font-size: 32px; font-weight: 600; padding: 18px 36px; border-radius: 12px; letter-spacing: 6px;">
            ${code}
          </span>
        </div>
        <p style="font-size: 15px; color: #555;">
          This code is valid for <strong>5 minutes</strong>.
        </p>
        <p style="font-size: 15px; color: #888;">
          Didn’t request this? Please ignore this email. Your account is safe.
        </p>
      </main>

      <footer style="background-color: #f0f4ff; padding: 20px; text-align: center; font-size: 13px; color: #666;">
        &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
      </footer>

    </div>
  </div>
`;

export default verificationCodeTemplate;
