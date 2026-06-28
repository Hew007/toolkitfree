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
      {items.map((item, index) => {
        const expanded = openIndex === index;
        const answerId = `faq-answer-${index}`;
        return (
          <div key={item.question} className="faq-item">
            <button
              type="button"
              className="faq-question"
              aria-expanded={expanded}
              aria-controls={answerId}
              onClick={() => setOpenIndex(expanded ? null : index)}
            >
              {item.question}
              <span aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
            <div id={answerId} className="faq-answer" hidden={!expanded}>
              {item.answer}
            </div>
          </div>
        );
      })}
    </section>
  );
}
