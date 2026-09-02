export const Hero = ({ subtitle, location }) => `
    <section class="hero">
        <div class="hero-svg-wrap">
            <svg class="hero-svg" viewBox="0 0 955 280" xmlns="http://www.w3.org/2000/svg">
                <!-- P -->
                <path class="hero-letter" style="--i:0;--d:1" fill-rule="evenodd"
                    d="M 0 0 H 135 V 160 H 42 V 280 H 0 Z M 42 30 L 100 80 L 42 130 Z"/>
                <!-- R -->
                <path class="hero-letter" style="--i:1;--d:-1" fill-rule="evenodd"
                    d="M 140 0 H 275 V 155 H 182 V 280 H 140 Z M 182 30 L 240 80 L 182 130 Z M 205 168 L 272 280 H 232 Z"/>
                <!-- A -->
                <path class="hero-letter" style="--i:2;--d:1" fill-rule="evenodd"
                    d="M 308 0 H 392 L 415 280 H 382 L 375 210 H 325 L 318 280 H 280 Z M 350 50 L 338 180 H 362 Z"/>
                <!-- T -->
                <path class="hero-letter" style="--i:3;--d:-1"
                    d="M 420 0 H 555 V 55 H 518 V 280 H 457 V 55 H 420 Z"/>
                <!-- E -->
                <path class="hero-letter" style="--i:4;--d:1"
                    d="M 560 0 H 695 V 48 H 608 V 116 H 678 V 164 H 608 V 232 H 695 V 280 H 560 Z"/>
                <!-- E -->
                <path class="hero-letter" style="--i:5;--d:-1"
                    d="M 700 0 H 835 V 48 H 748 V 116 H 818 V 164 H 748 V 232 H 835 V 280 H 700 Z"/>
                <!-- K -->
                <path class="hero-letter" style="--i:6;--d:1"
                    d="M 840 0 H 885 V 75 L 935 0 H 955 L 900 125 L 955 280 H 935 L 885 185 V 280 H 840 Z"/>
            </svg>
        </div>
        <div class="hero-line"></div>
        <div class="hero-info">
            <p class="tagline">${subtitle}</p>
            <p class="location">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${location}
            </p>
        </div>
        <div class="scroll-down">Scroll</div>
    </section>
`;
