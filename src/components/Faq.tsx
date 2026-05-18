import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqProps {
  items: FaqItem[];
}

export default function Faq({ items }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="faq-section">
      <h2>Frequently Asked Questions</h2>
      {items.map((item, index) => (
        <div key={index} className="faq-item">
          <button
            className="faq-question"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            {item.question}
            <span>{openIndex === index ? '−' : '+'}</span>
          </button>
          <div className="faq-answer" hidden={openIndex !== index}>
            {item.answer}
          </div>
        </div>
      ))}
    </section>
  );
}
