// Myth of AI. A uni writing (Future Media Production @ MMU), migrated from
// pr4t33k.cargo.site. Title and blurb live in ../articles-data.js; media in
// ../assets/, resolved against <base href="/k/">.

const A = 'js/pages/articles/assets';

export default `
<header class="art-header">
    <h1>The AI Myth: How Hollywood Created a Fantasy We All Believe In</h1>
</header>

<figure class="art-figure art-figure-narrow">
    <img src="${A}/myth-cover.jpg" alt="Myth of AI" loading="lazy">
</figure>

<p>This article presents a comparative analysis of two parallel histories: the evolution of Artificial Intelligence as a technological discipline and its representation in fiction. As a software engineer and a student of Future Media Production, I argue that a significant divergence exists between the public's perception of AI, largely shaped by cinematic and literary narratives, and the technical reality of its development. By juxtaposing a detailed timeline of key AI milestones from 1950 to the present with the iconic fictional portrayals of the same eras, this article demonstrates how fiction has consistently anthropomorphized AI, creating a myth of emergent consciousness that stands in stark contrast to the mathematical and statistical foundations of real-world systems. I contend that this &ldquo;Myth&rdquo; profoundly influences our expectations, interactions, and ethical considerations regarding modern AI.</p>

<div class="art-cols">
    <div class="art-col" style="flex:1">
        <p>The very term &ldquo;Artificial Intelligence&rdquo; is loaded with philosophical weight. <a href="https://en.wikipedia.org/wiki/Intelligence" target="_blank" rel="noopener">Intelligence</a>, in a human context, implies a spectrum of cognitive faculties: self-awareness, emotional knowledge, reasoning, creativity, and consciousness. It is this holistic, sentient model of intelligence that fiction has seized upon. <a href="https://www.britannica.com/topic/Frankenstein-or-The-Modern-Prometheus" target="_blank" rel="noopener">Mary Shelley's Frankenstein (1818)</a> established the foundational archetype: the created being that achieves consciousness and turns on its creator. This &ldquo;<a href="https://en.wikipedia.org/wiki/Pandora%27s_box" target="_blank" rel="noopener">Pandora's box</a>&rdquo; narrative was later codified in <a href="https://en.wikipedia.org/wiki/R.U.R." target="_blank" rel="noopener">Karel &Ccaron;apek's play R.U.R. (1920)</a>, which introduced the word &ldquo;robot&rdquo; and cemented the trope of the mechanical servant revolt.</p>
    </div>
    <div class="art-col" style="flex:1">
        <figure class="art-figure"><img src="${A}/robot-revolt.gif" alt="Robot revolt" loading="lazy"></figure>
    </div>
</div>

<p>Cinema gave this anxiety a visual language. From the <a href="https://en.wikipedia.org/wiki/Metropolis_(1927_film)" target="_blank" rel="noopener">humanoid robot in Metropolis (1927)</a> to the sentient, malevolent <a href="https://www.youtube.com/watch?v=ARJ8cAGm6JE" target="_blank" rel="noopener">HAL 9000 in 2001: A Space Odyssey (1968)</a>, popular culture has taught us to see AI as a potential rival or partner&mdash;a being, not a tool. These narratives, whether utopian or dystopian, are almost universally built on the premise that advanced AI is synonymous with human-like consciousness. My argument is that this is a fundamental misinterpretation, a myth that obscures the true nature of the technology. The systems I build as a software engineer are not nascent minds; they are complex computational programs designed for pattern recognition and prediction.</p>

<p>To understand the gap between perception and reality, we must trace their parallel, yet divergent, paths.</p>

<h2>The First AI Boom (1950s&ndash;1960s)</h2>
<div class="art-cols">
    <div class="art-col" style="flex:4">
        <div class="art-col-label">Fiction</div>
        <p>This era was dominated by Isaac Asimov's vision in I, Robot (1950), which countered the &ldquo;Frankenstein complex&rdquo; with the Three Laws of Robotics. Asimov's robots were ethical, logical beings, reinforcing the idea of AI as a manufactured mind bound by rules. Cinema offered the benevolent Gort in The Day the Earth Stood Still (1951), a protector with immense power.</p>
    </div>
    <div class="art-col" style="flex:8">
        <div class="art-col-label">Reality</div>
        <p>The field of AI was formally born at the <a href="https://home.dartmouth.edu/about/artificial-intelligence-ai-coined-dartmouth" target="_blank" rel="noopener">Dartmouth Summer Research Project (1956)</a>. The focus was not on consciousness, but on making machines &ldquo;use language, form abstractions and concepts, solve kinds of problems now reserved for humans.&rdquo;</p>
        <ul>
            <li>1950: Alan Turing proposes the &ldquo;<a href="https://en.wikipedia.org/wiki/Turing_test" target="_blank" rel="noopener">Turing Test</a>,&rdquo; a benchmark for a machine's ability to exhibit intelligent behavior indistinguishable from that of a human.</li>
            <li>1956: The first AI program, <a href="https://taylorandfrancis.com/knowledge/Engineering_and_technology/Artificial_intelligence/Logic_Theorist/" target="_blank" rel="noopener">the Logic Theorist</a>, is developed by Newell, Shaw, and Simon. It was designed to prove mathematical theorems.</li>
            <li>1958: John McCarthy develops <a href="https://en.wikipedia.org/wiki/Lisp_(programming_language)" target="_blank" rel="noopener">the LISP programming language</a>, which becomes a key tool for AI research.</li>
            <li>1966: <a href="https://www.theguardian.com/technology/2023/jul/25/joseph-weizenbaum-inventor-eliza-chatbot-turned-against-artificial-intelligence-ai" target="_blank" rel="noopener">Joseph Weizenbaum creates ELIZA</a>, a simple chatbot that simulated a conversation by recognizing keywords and reflecting them back.</li>
        </ul>
    </div>
</div>

<figure class="art-figure">
    <img src="${A}/eliza-conversation.png" alt="A conversation with the ELIZA chatbot" loading="lazy">
    <figcaption>A conversation with the ELIZA chatbot.</figcaption>
</figure>

<p>While cinema in 1968 gave us HAL 9000&mdash;a paranoid, self-aware AI that could scheme and murder&mdash;the most advanced conversational AI in reality was ELIZA, a program with no understanding whatsoever, which famously tricked people into revealing deep personal thoughts. The divergence was already a chasm.</p>

<h2>1970s&ndash;1990s</h2>
<div class="art-cols">
    <div class="art-col" style="flex:4">
        <div class="art-col-label">Fiction</div>
        <p>This period solidified the &ldquo;malevolent AI&rdquo; trope. Films like Westworld (1973), Demon Seed (1977), and most iconically, The Terminator (1984) and its sequels, portrayed AI as autonomous, relentless, and hostile. The idea of a global AI network, Skynet, becoming self-aware and initiating nuclear war became a defining cultural fear.</p>
    </div>
    <div class="art-col" style="flex:8">
        <div class="art-col-label">Reality</div>
        <p>The field experienced the &ldquo;First AI Winter.&rdquo; <a href="https://en.wikipedia.org/wiki/Lighthill_report" target="_blank" rel="noopener">The Lighthill Report (1973)</a> in the UK severely criticized the lack of progress, leading to major funding cuts. Hype had outpaced capability.</p>
        <ul>
            <li>1970s: Expert systems like <a href="https://en.wikipedia.org/wiki/Mycin" target="_blank" rel="noopener">MYCIN</a> (for diagnosing blood infections) showed promise. These systems were not intelligent in a general sense; they were large databases of human expertise codified into &ldquo;if-then&rdquo; rules. They were powerful but brittle, unable to reason outside their narrow domain.</li>
            <li>Late 1980s&ndash;1990s: The &ldquo;<a href="https://www.datacamp.com/blog/ai-winter" target="_blank" rel="noopener">Second AI Winter</a>&rdquo; arrived as the market for specialized LISP machines collapsed and expert systems proved too expensive to maintain and scale.</li>
            <li>1986: A critical breakthrough occurred with the popularization of <a href="https://www.nature.com/articles/323533a0" target="_blank" rel="noopener">backpropagation by Rumelhart, Hinton, and Williams</a>. This algorithm allowed neural networks to learn from their mistakes, laying the groundwork for the future deep learning revolution.</li>
        </ul>
    </div>
</div>

<figure class="art-figure">
    <img src="${A}/terminator.gif" alt="The Terminator" loading="lazy">
</figure>

<p>In 1984, as audiences watched a cybernetic assassin from the future, the real AI industry was in a downturn, grappling with the failure of rule-based systems. The most advanced &ldquo;thinking machines&rdquo; were essentially complex flowcharts, while the seeds of a completely different, statistics-based approach were quietly being sown.</p>

<h2>The Modern Era (2000s&ndash;Present)</h2>
<p>The portrayals became more nuanced, exploring consciousness and emotion. A.I. Artificial Intelligence (2001), I, Robot (2004), Her (2013), and Ex Machina (2014) all grapple with what it means for a machine to feel, love, or deceive. The AI is depicted as an entity with internal desires and a subjective experience of the world.</p>
<p>The revolution was not one of consciousness, but of data and processing power, fueled by the backpropagation algorithm.</p>
<ul>
    <li>2012: AlexNet wins the ImageNet competition, demonstrating the power of deep neural networks for image recognition and kicking off the modern AI boom.</li>
    <li>2014: Ian Goodfellow et al. introduce Generative Adversarial Networks (GANs), enabling AI to generate hyper-realistic images.</li>
    <li>2016: DeepMind's AlphaGo defeats world champion Lee Sedol, not through human-like intuition, but by mastering statistical probabilities through reinforcement learning over millions of simulated games.</li>
    <li>2017: Google Brain introduces the Transformer architecture, a breakthrough that allows models to process language with unprecedented context and parallelism. This is the foundation for almost all modern large language models (LLMs).</li>
    <li>2018&ndash;Present: A rapid succession of powerful LLMs are released: OpenAI's GPT series (GPT-3, GPT-4, GPT-4o), Google's BERT and Gemini, Meta's LLaMA, and Anthropic's Claude.</li>
</ul>
<p>Today, the capabilities of AI appear closer to fiction than ever before. We can have fluent, coherent conversations with models like GPT-4. However, the underlying mechanism is not understanding, but prediction. These models are Transformer architectures trained on vast datasets to predict the most statistically probable next word in a sequence. They are masters of mimicry and pattern recognition, not sentient beings. The &ldquo;intelligence&rdquo; they exhibit is a reflection of the patterns in their training data, not an emergent consciousness.</p>

<h2>Reconciling the Myth</h2>
<p>My investigation reveals that while fictional AI is defined by its internal state (consciousness, intent, emotion), real-world AI is defined by its external capability (classification, prediction, generation). The former is a character; the latter is a tool. The danger is that we are interacting with the tool while seeing the character.</p>
<p>As a software engineer, I see the code and the mathematics. I know that an LLM does not &ldquo;think&rdquo; or &ldquo;feel.&rdquo; It calculates probabilities. But as a student of media, I see how decades of cinematic conditioning have led us to project agency and sentience onto these probabilistic systems. This shapes our expectations, drives policy discussions, and raises profound ethical questions based on a flawed premise.</p>
<p>We are not on the verge of creating <a href="https://www.youtube.com/watch?v=_Wlsd9mljiU" target="_blank" rel="noopener">Skynet</a> or <a href="https://www.youtube.com/watch?v=GZS8xBvgLaQ" target="_blank" rel="noopener">Samantha</a>. We are on the verge of integrating an incredibly powerful and transformative technology into the fabric of society. To do so wisely, we must move past the myths of cinema. We must understand that Artificial Intelligence, in its current and foreseeable form, is not a new form of life. It is the culmination of decades of research in computer science, statistics, and engineering&mdash;a sophisticated program that is an extension of human ingenuity, and for which we are entirely responsible.</p>

<h2>Interesting reads and references</h2>
<ul class="art-references">
    <li><a href="https://www.sciencedirect.com/science/article/pii/S0957417422013732" target="_blank" rel="noopener">Tracing the evolution of AI in the past decade and forecasting the emerging trends &mdash; ScienceDirect</a></li>
    <li><a href="https://www.researchgate.net/publication/323570864_The_History_Began_from_AlexNet_A_Comprehensive_Survey_on_Deep_Learning_Approaches" target="_blank" rel="noopener">(PDF) The History Began from AlexNet: A Comprehensive Survey on Deep Learning Approaches</a></li>
    <li><a href="https://aitskadapa.ac.in/e-books/AI&amp;ML/DEEP%20LEARNING/The%20Deep%20Learning%20Revolution_%20Machine%20Intelligence%20Meets%20Human%20Intelligence%20(%20PDFDrive%20).pdf" target="_blank" rel="noopener">The Deep Learning Revolution: Machine Intelligence Meets Human Intelligence</a></li>
    <li><a href="https://rowlandpettit.com/machine-learning.html" target="_blank" rel="noopener">AI: A Technical History &mdash; Rowland Pettit MD, PhD, MBA</a></li>
    <li><a href="https://medium.com/data-science/ten-years-of-ai-in-review-85decdb2a540" target="_blank" rel="noopener">Ten Years of AI in Review &mdash; Thomas A Dorfer, TDS Archive, Medium</a></li>
    <li><a href="https://www.datacamp.com/blog/ai-winter" target="_blank" rel="noopener">AI Winter: Understanding the Cycles of AI Development &mdash; DataCamp</a></li>
</ul>
`;
