import { useState } from '../framework.js';

export default function Test() {
    const [count, setCount] = useState(0);
    window.increment = () => {
        setCount(count + 1);
    };

    return `
        <div class="test-page" style="padding: 100px; text-align: center;">
            <h1>Test Page</h1>
            
            <button 
                onclick="window.increment()"
                style="padding: 10px 20px; font-size: 1.2rem; cursor: pointer; margin-top: 20px;"
            >
                Count is: ${count}
            </button>

            <p style="margin-top: 20px; color: #666;">
                (Clicking the button updates the state and re-renders likely React)
            </p>
            
            <a href="/" data-link style="display: block; margin-top: 30px;">← Back home</a>
        </div>
    `;
}
