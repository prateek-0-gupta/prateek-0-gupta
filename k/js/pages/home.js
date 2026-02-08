import { useState, useEffect } from '../framework.js';
import { Hero } from '../components/Hero.js';
import { Experience, ExperienceItem } from '../components/Experience.js';
import { Skills } from '../components/Skills.js';
import { Footer } from '../components/Footer.js';

export default function Home() {
    const [showAllSkills, setShowAllSkills] = useState(false);
    const allSkills = [
        "Python / PyTorch", "AI/ML Models", "Next.js / React", 
        "Unreal Engine", "Blender / 3D", "Motion Capture", 
        "Node.js", "Adobe Creative Suite", "Three.js", "WebGL", 
        "C++", "System Architecture"
    ];

    const visibleSkills = showAllSkills ? allSkills : allSkills.slice(0, 8);

    useEffect(() => {
        console.log("Skills toggled:", showAllSkills);
    }, [showAllSkills]);

    window.toggleSkills = () => setShowAllSkills(!showAllSkills);

    const heroProps = {
        // title: 'Prateek <span>Gupta</span><a href="/test" data-link style="font-size:0.5em; opacity:0.5; text-decoration:none;">(test)</a>' ,
        title: 'Prateek <span>Gupta</span>',
        subtitle: 'Building the next generation of <strong>Digital Humans</strong> & AI interfaces.',
        location: 'Manchester, United Kingdom'
    };

    const jobs = [
        {meta: '2024 — 2025', title: 'AI & Creative Analyst', company: 'Sum Vivas Ltd'},
        {meta: '2021 — Present', title: 'Freelance Multimedia Artist', company: 'Creative Studio'},
        {meta: '2023 — 2024', title: 'Digital Participation Designer', company: 'Mindset Revolution'},
        {meta: '2022 — 2023', title: 'Multimedia Artist', company: 'The Public House, Dubai'}
    ];

    return `
    <div class="container">
        
        ${Hero(heroProps)}

        <section id="current" class="reveal">
            <h2 class="section-title">Current Focus</h2>
            ${ExperienceItem({
                meta: 'Jun 2025 — Present',
                title: 'Head of AI & Development',
                company: 'Sum Vivas Ltd',
                desc: 'Leading AI innovation and development for next-generation digital solutions and virtual entities.'
            })}
        </section>

        ${Experience({ jobs })}

        <section id="skills" class="reveal">
            <h2 class="section-title">Core Competencies</h2>
            
            <div class="skills-grid">
                ${visibleSkills.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
            </div>

            <div style="margin-top: 2rem; text-align: center;">
                <button 
                    onclick="window.toggleSkills()"
                    style="
                        padding: 0.8rem 1.5rem; 
                        background: transparent; 
                        border: 1px solid var(--text-dim); 
                        color: var(--text);
                        cursor: pointer;
                        font-family: inherit;
                        border-radius: 4px;
                    "
                >
                    ${showAllSkills ? 'Show Less' : 'Show More'}
                </button>
            </div>
        </section>

        <section id="education" class="reveal">
            <h2 class="section-title">Education</h2>
            ${ExperienceItem({
                meta: '2022 — 2026', title: 'BA Future Media Production', company: 'Manchester Metropolitan University'
            })}
             ${ExperienceItem({
                meta: '2016 — 2019', title: 'BSc Information Technology', company: 'Aryan Institute of Technology'
            })}
        </section>

        ${Footer()}
    </div>
    `;
}
