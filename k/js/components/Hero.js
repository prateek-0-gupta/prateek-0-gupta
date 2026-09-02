export const Hero = ({ title, subtitle, location }) => `
    <section class="hero">
        <div class="reveal">
            <h1>${title}</h1>
            <p class="tagline">${subtitle}</p>
            <p class="location">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${location}
            </p>
        </div>
        <div class="scroll-down">Scroll</div>
    </section>
`;
