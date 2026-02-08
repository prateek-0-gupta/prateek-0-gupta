export const ExperienceItem = ({ meta, title, company, desc = '' }) => `
    <div class="exp-item">
        <div class="exp-meta">${meta}</div>
        <div class="exp-content">
            <div class="exp-title">${title}</div>
            <div class="exp-company">${company}</div>
            ${desc ? `<p class="exp-desc">${desc}</p>` : ''}
        </div>
    </div>
`;

export const Experience = ({ jobs }) => `
    <section id="experience" class="reveal">
        <h2 class="section-title">Selected Experience</h2>
        ${jobs.map(job => ExperienceItem(job)).join('')}
    </section>
`;
