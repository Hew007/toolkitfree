import { useState, useEffect } from 'react';
import {
  buildEmailString as encodeEmail,
  buildSmsString as encodeSms,
  buildVcardString as encodeVcard,
  buildWifiString as encodeWifi,
} from '../lib/qr-data';

export type QrType = 'text' | 'wifi' | 'vcard' | 'email' | 'phone' | 'sms';

interface QrInputFormProps {
  type: QrType;
  onTypeChange: (type: QrType) => void;
  onDataChange: (data: string) => void;
}

const TABS: { key: QrType; label: string }[] = [
  { key: 'text', label: 'Text / URL' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'vcard', label: 'vCard' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'sms', label: 'SMS' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 500,
  marginBottom: '0.25rem',
  display: 'block',
  color: '#374151',
};

const fieldGroup: React.CSSProperties = {
  marginBottom: '0.75rem',
};

function buildWifiString(security: string, ssid: string, password: string, hidden: boolean): string {
  return encodeWifi(security, ssid, password, hidden);
}

function buildVcardString(first: string, last: string, phone: string, email: string, company: string, title: string, website: string): string {
  return encodeVcard({ first, last, phone, email, company, title, website });
}

function buildEmailString(email: string, subject: string, body: string): string {
  return encodeEmail(email, subject, body);
}

function buildSmsString(phone: string, message: string): string {
  return encodeSms(phone, message);
}

export default function QrInputForm({ type, onTypeChange, onDataChange }: QrInputFormProps) {
  // Text/URL
  const [text, setText] = useState('');
  // WiFi
  const [wifiSecurity, setWifiSecurity] = useState('WPA');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiHidden, setWifiHidden] = useState(false);
  // vCard
  const [vFirst, setVFirst] = useState('');
  const [vLast, setVLast] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vCompany, setVCompany] = useState('');
  const [vTitle, setVTitle] = useState('');
  const [vWebsite, setVWebsite] = useState('');
  // Email
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  // Phone
  const [phone, setPhone] = useState('');
  // SMS
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  useEffect(() => {
    let result = '';
    switch (type) {
      case 'text': result = text; break;
      case 'wifi': result = buildWifiString(wifiSecurity, wifiSsid, wifiPassword, wifiHidden); break;
      case 'vcard': result = buildVcardString(vFirst, vLast, vPhone, vEmail, vCompany, vTitle, vWebsite); break;
      case 'email': result = buildEmailString(emailTo, emailSubject, emailBody); break;
      case 'phone': result = phone ? `tel:${phone}` : ''; break;
      case 'sms': result = buildSmsString(smsPhone, smsMessage); break;
    }
    onDataChange(result);
  }, [type, text, wifiSecurity, wifiSsid, wifiPassword, wifiHidden, vFirst, vLast, vPhone, vEmail, vCompany, vTitle, vWebsite, emailTo, emailSubject, emailBody, phone, smsPhone, smsMessage]);

  return (
    <div data-qr-input-type={type}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-qr-tab={tab.key}
            onClick={() => onTypeChange(tab.key)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: 6,
              border: type === tab.key ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: type === tab.key ? '#2563eb' : '#fff',
              color: type === tab.key ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text/URL */}
      {type === 'text' && (
        <div style={fieldGroup}>
          <label style={labelStyle}>Text or URL</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text or URL..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      )}

      {/* WiFi */}
      {type === 'wifi' && (
        <>
          <div style={fieldGroup}>
            <label style={labelStyle}>Security</label>
            <select value={wifiSecurity} onChange={(e) => setWifiSecurity(e.target.value)} style={inputStyle}>
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="none">None</option>
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Network Name (SSID)</label>
            <input type="text" value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="MyWiFi" style={inputStyle} />
          </div>
          {wifiSecurity !== 'none' && (
            <div style={fieldGroup}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="WiFi password" style={inputStyle} />
            </div>
          )}
          <div style={fieldGroup}>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={wifiHidden} onChange={(e) => setWifiHidden(e.target.checked)} />
              Hidden network
            </label>
          </div>
        </>
      )}

      {/* vCard */}
      {type === 'vcard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input type="text" value={vFirst} onChange={(e) => setVFirst(e.target.value)} placeholder="John" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input type="text" value={vLast} onChange={(e) => setVLast(e.target.value)} placeholder="Doe" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input type="tel" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+1234567890" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="john@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input type="text" value={vCompany} onChange={(e) => setVCompany(e.target.value)} placeholder="Company" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Job Title</label>
            <input type="text" value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="Developer" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Website</label>
            <input type="url" value={vWebsite} onChange={(e) => setVWebsite(e.target.value)} placeholder="https://example.com" style={inputStyle} />
          </div>
        </div>
      )}

      {/* Email */}
      {type === 'email' && (
        <>
          <div style={fieldGroup}>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="someone@example.com" style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Subject</label>
            <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject" style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Body</label>
            <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Email body..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </>
      )}

      {/* Phone */}
      {type === 'phone' && (
        <div style={fieldGroup}>
          <label style={labelStyle}>Phone Number</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" style={inputStyle} />
        </div>
      )}

      {/* SMS */}
      {type === 'sms' && (
        <>
          <div style={fieldGroup}>
            <label style={labelStyle}>Phone Number</label>
            <input type="tel" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+1234567890" style={inputStyle} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Message</label>
            <textarea value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} placeholder="Your message..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </>
      )}
    </div>
  );
}
