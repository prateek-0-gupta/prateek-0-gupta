export const Skills = ({ skills = [] }) => `
    <section id="skills" class="reveal">
        <h2 class="section-title">Core Competencies</h2>
        <div class="skills-grid">
            ${skills.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
        </div>
    </section>
`;
