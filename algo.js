function evaluateLocator(xpath, css, element) {
    const weights = {
        length: 0.1,
        specificity: 0.2,
        readability: 0.2,
        performance: 0.3,
        robustness: 0.2
    };

    let xpathScore = 0;
    let cssScore = 0;
    
    // 1. Length of the selector
    xpathScore += normalizeScore(xpath.length, 0, 100) * -weights.length;
    cssScore += normalizeScore(css.length, 0, 100) * -weights.length;
    
    // 2. Specificity
    xpathScore += calculateXPathSpecificity(xpath) * weights.specificity;
    cssScore += calculateCSSSpecificity(css) * weights.specificity;
    
    // 3. Readability
    xpathScore += evaluateReadability(xpath) * weights.readability;
    cssScore += evaluateReadability(css) * weights.readability;
    
    // 4. Performance (execution time)
    xpathScore += measurePerformance(xpath, element, 'xpath') * weights.performance;
    cssScore += measurePerformance(css, element, 'css') * weights.performance;
    
    // 5. Robustness (resistance to changes in the DOM)
    xpathScore += evaluateRobustness(xpath, element, 'xpath') * weights.robustness;
    cssScore += evaluateRobustness(css, element, 'css') * weights.robustness;
    
    // Compare scores
    const threshold = 0.1; // 10% difference threshold
    if (xpathScore > cssScore * (1 + threshold)) {
        return { result: "XPath is better", xpathScore, cssScore };
    } else if (cssScore > xpathScore * (1 + threshold)) {
        return { result: "CSS is better", xpathScore, cssScore };
    } else {
        return { result: "Both are equally good", xpathScore, cssScore };
    }
}

function calculateXPathSpecificity(xpath) {
    let score = 0;
    if (xpath.includes('id(')) score += 100;
    if (xpath.includes('@class')) score += 10;
    if (xpath.includes('@')) score += 20; // Other attributes
    score += (xpath.match(/\/\/|\//g) || []).length * 5; // Axes
    score += (xpath.match(/\[.*?\]/g) || []).length * 15; // Predicates
    return normalizeScore(score, 0, 200);
}

function calculateCSSSpecificity(css) {
    let score = 0;
    score += (css.match(/#/g) || []).length * 100; // IDs
    score += (css.match(/\./g) || []).length * 10; // Classes
    score += (css.match(/\[.*?\]/g) || []).length * 10; // Attribute selectors
    score += (css.match(/:[a-zA-Z-()]+/g) || []).length * 10; // Pseudo-classes and pseudo-elements
    score += (css.match(/[a-zA-Z]/g) || []).length; // Element selectors
    return normalizeScore(score, 0, 200);
}

function evaluateReadability(selector) {
    const specialChars = selector.replace(/[a-zA-Z0-9]/g, '').length;
    const words = selector.split(/[^a-zA-Z]+/).filter(Boolean).length;
    return normalizeScore(10 - specialChars * 0.5 + words * 2, 0, 20);
}

function measurePerformance(selector, element, type) {
    const iterations = 1000;
    const start = performance.now();
    try {
        for (let i = 0; i < iterations; i++) {
            if (type === 'xpath') {
                document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            } else {
                document.querySelector(selector);
            }
        }
    } catch (error) {
        return 0; // Penalize invalid selectors
    }
    const end = performance.now();
    const averageTime = (end - start) / iterations;
    return normalizeScore(100 - averageTime, 0, 100); // Higher score for faster execution
}

function evaluateRobustness(selector, element, type) {
    let score = 0;
    
    if (type === 'xpath') {
        if (selector.includes('id(')) score += 50;
        if (selector.includes('@class')) score += 30;
        if (selector.includes('contains')) score += 20;
        if (selector.includes('text()')) score += 10;
        if (selector.includes('following-sibling') || selector.includes('preceding-sibling')) score += 15;
        if (selector.startsWith('//')) score -= 10; // Penalize starting with '//'
    } else { // CSS
        if (selector.includes('#')) score += 50;
        if (selector.includes('.')) score += 30;
        if (selector.includes('[')) score += 20; // Attribute selectors
        if (selector.includes(':nth-child') || selector.includes(':nth-of-type')) score += 15;
        if (selector.includes('>')) score += 10; // Direct child
    }
    
    // Check uniqueness
    try {
        const elements = (type === 'xpath') 
            ? document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
            : document.querySelectorAll(selector);
        const count = (type === 'xpath') ? elements.snapshotLength : elements.length;
        score += (count === 1) ? 50 : 0; // Bonus for unique selectors
    } catch (error) {
        score -= 50; // Penalize invalid selectors
    }
    
    return normalizeScore(score, 0, 200);
}

function normalizeScore(score, min, max) {
    return (score - min) / (max - min);
}

// Helper function to get element attributes
function getElementAttributes(element) {
    const attributes = {};
    for (let attr of element.attributes) {
        attributes[attr.name] = attr.value;
    }
    return attributes;
}

// Helper function to generate alternative selectors
function generateAlternativeSelectors(element) {
    const attributes = getElementAttributes(element);
    const alternatives = [];

    if (attributes.id) {
        alternatives.push(`#${attributes.id}`);
        alternatives.push(`//*[@id="${attributes.id}"]`);
    }

    if (attributes.class) {
        const classes = attributes.class.split(' ');
        alternatives.push(`.${classes.join('.')}`);
        alternatives.push(`//*[contains(@class, "${classes[0]}")]`);
    }

    // Add more alternative selector generation logic here

    return alternatives;
}

// Main function to evaluate and suggest the best locator
function suggestBestLocator(element) {
    const initialXPath = generateXPath(element);
    const initialCSS = generateCSSSelector(element);

    let bestLocator = evaluateLocator(initialXPath, initialCSS, element);
    
    const alternatives = generateAlternativeSelectors(element);
    
    for (let alt of alternatives) {
        const isXPath = alt.startsWith('/');
        const result = evaluateLocator(isXPath ? alt : initialXPath, isXPath ? initialCSS : alt, element);
        if (result.xpathScore > bestLocator.xpathScore || result.cssScore > bestLocator.cssScore) {
            bestLocator = result;
        }
    }

    return {
        bestLocator: bestLocator.result,
        xpathScore: bestLocator.xpathScore,
        cssScore: bestLocator.cssScore,
        recommendedXPath: bestLocator.result.includes('XPath') ? initialXPath : null,
        recommendedCSS: bestLocator.result.includes('CSS') ? initialCSS : null
    };
}

// Function to generate XPath (simplified version, can be improved)
function generateXPath(element) {
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
        return '/html/body';
    }
    let path = '';
    while (element.parentElement) {
        let siblingIndex = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.nodeName === element.nodeName) {
                siblingIndex++;
            }
            sibling = sibling.previousElementSibling;
        }
        path = `/${element.nodeName.toLowerCase()}[${siblingIndex}]${path}`;
        element = element.parentElement;
    }
    return `/${path}`;
}

// Function to generate CSS selector (simplified version, can be improved)
function generateCSSSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    let path = [];
    while (element.parentElement) {
        if (element.id) {
            path.unshift(`#${element.id}`);
            break;
        }
        let selector = element.nodeName.toLowerCase();
        if (element.className) {
            selector += `.${element.className.split(' ').join('.')}`;
        }
        let sibling = element;
        let siblingIndex = 1;
        while (sibling.previousElementSibling) {
            sibling = sibling.previousElementSibling;
            if (sibling.nodeName === element.nodeName) {
                siblingIndex++;
            }
        }
        if (siblingIndex > 1) {
            selector += `:nth-of-type(${siblingIndex})`;
        }
        path.unshift(selector);
        element = element.parentElement;
    }
    return path.join(' > ');
}

// Function to test the locator
function testLocator(locator, isXPath) {
    try {
        const elements = isXPath 
            ? document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
            : document.querySelectorAll(locator);
        return (isXPath ? elements.snapshotLength : elements.length) === 1;
    } catch (error) {
        return false;
    }
}

// Usage example
function analyzeElement(element) {
    if (!(element instanceof Element)) {
        throw new Error('Invalid input: element must be a DOM Element');
    }

    const result = suggestBestLocator(element);
    console.log('Best locator type:', result.bestLocator);
    console.log('XPath score:', result.xpathScore.toFixed(2));
    console.log('CSS score:', result.cssScore.toFixed(2));
    
    if (result.recommendedXPath) {
        console.log('Recommended XPath:', result.recommendedXPath);
        console.log('XPath is unique:', testLocator(result.recommendedXPath, true));
    }
    
    if (result.recommendedCSS) {
        console.log('Recommended CSS:', result.recommendedCSS);
        console.log('CSS is unique:', testLocator(result.recommendedCSS, false));
    }

    return result;
}

// Error handling wrapper
function safeEvaluateLocator(xpath, css, element) {
    try {
        return evaluateLocator(xpath, css, element);
    } catch (error) {
        console.error('Error evaluating locators:', error);
        return {
            result: "Error evaluating locators",
            xpathScore: 0,
            cssScore: 0
        };
    }
}

// Improved performance measurement with timeout
function measurePerformanceWithTimeout(selector, element, type) {
    const timeout = 1000; // 1 second timeout
    const iterations = 1000;
    
    return new Promise((resolve) => {
        const worker = new Worker(URL.createObjectURL(new Blob([`
            self.onmessage = function(e) {
                const { selector, type, iterations } = e.data;
                const start = performance.now();
                try {
                    for (let i = 0; i < iterations; i++) {
                        if (type === 'xpath') {
                            document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        } else {
                            document.querySelector(selector);
                        }
                    }
                    const end = performance.now();
                    const averageTime = (end - start) / iterations;
                    self.postMessage({ score: 100 - averageTime });
                } catch (error) {
                    self.postMessage({ score: 0 });
                }
            };
        `])));

        const timeoutId = setTimeout(() => {
            worker.terminate();
            resolve(0);
        }, timeout);

        worker.onmessage = (e) => {
            clearTimeout(timeoutId);
            worker.terminate();
            resolve(normalizeScore(e.data.score, 0, 100));
        };

        worker.postMessage({ selector, type, iterations });
    });
}

// Update the evaluateLocator function to use the new measurePerformanceWithTimeout
async function evaluateLocatorAsync(xpath, css, element) {
    // ... (previous code remains the same)

    // 4. Performance (execution time)
    xpathScore += await measurePerformanceWithTimeout(xpath, element, 'xpath') * weights.performance;
    cssScore += await measurePerformanceWithTimeout(css, element, 'css') * weights.performance;

    // ... (rest of the function remains the same)
}

// Main function to evaluate and suggest the best locator (async version)
async function suggestBestLocatorAsync(element) {
    const initialXPath = generateXPath(element);
    const initialCSS = generateCSSSelector(element);

    let bestLocator = await evaluateLocatorAsync(initialXPath, initialCSS, element);
    
    const alternatives = generateAlternativeSelectors(element);
    
    for (let alt of alternatives) {
        const isXPath = alt.startsWith('/');
        const result = await evaluateLocatorAsync(isXPath ? alt : initialXPath, isXPath ? initialCSS : alt, element);
        if (result.xpathScore > bestLocator.xpathScore || result.cssScore > bestLocator.cssScore) {
            bestLocator = result;
        }
    }

    return {
        bestLocator: bestLocator.result,
        xpathScore: bestLocator.xpathScore,
        cssScore: bestLocator.cssScore,
        recommendedXPath: bestLocator.result.includes('XPath') ? initialXPath : null,
        recommendedCSS: bestLocator.result.includes('CSS') ? initialCSS : null
    };
}

// Async version of analyzeElement
async function analyzeElementAsync(element) {
    if (!(element instanceof Element)) {
        throw new Error('Invalid input: element must be a DOM Element');
    }

    try {
        const result = await suggestBestLocatorAsync(element);
        console.log('Best locator type:', result.bestLocator);
        console.log('XPath score:', result.xpathScore.toFixed(2));
        console.log('CSS score:', result.cssScore.toFixed(2));
        
        if (result.recommendedXPath) {
            console.log('Recommended XPath:', result.recommendedXPath);
            console.log('XPath is unique:', await testLocatorAsync(result.recommendedXPath, true));
        }
        
        if (result.recommendedCSS) {
            console.log('Recommended CSS:', result.recommendedCSS);
            console.log('CSS is unique:', await testLocatorAsync(result.recommendedCSS, false));
        }

        return result;
    } catch (error) {
        console.error('Error analyzing element:', error);
        throw error;
    }
}

// Async version of testLocator
async function testLocatorAsync(locator, isXPath) {
    return new Promise((resolve) => {
        const timeout = 1000; // 1 second timeout
        const worker = new Worker(URL.createObjectURL(new Blob([`
            self.onmessage = function(e) {
                const { locator, isXPath } = e.data;
                try {
                    const elements = isXPath 
                        ? document.evaluate(locator, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
                        : document.querySelectorAll(locator);
                    self.postMessage({ isUnique: (isXPath ? elements.snapshotLength : elements.length) === 1 });
                } catch (error) {
                    self.postMessage({ isUnique: false });
                }
            };
        `])));

        const timeoutId = setTimeout(() => {
            worker.terminate();
            resolve(false);
        }, timeout);

        worker.onmessage = (e) => {
            clearTimeout(timeoutId);
            worker.terminate();
            resolve(e.data.isUnique);
        };

        worker.postMessage({ locator, isXPath });
    });
}

// Improved error handling for evaluateLocatorAsync
async function safeEvaluateLocatorAsync(xpath, css, element) {
    try {
        return await evaluateLocatorAsync(xpath, css, element);
    } catch (error) {
        console.error('Error evaluating locators:', error);
        return {
            result: "Error evaluating locators",
            xpathScore: 0,
            cssScore: 0,
            error: error.message
        };
    }
}

// Function to validate input
function validateInput(xpath, css, element) {
    if (typeof xpath !== 'string' || xpath.trim() === '') {
        throw new Error('Invalid XPath: must be a non-empty string');
    }
    if (typeof css !== 'string' || css.trim() === '') {
        throw new Error('Invalid CSS selector: must be a non-empty string');
    }
    if (!(element instanceof Element)) {
        throw new Error('Invalid element: must be a DOM Element');
    }
}

// Main function to use all the improvements
async function analyzeAndSuggestLocator(element) {
    try {
        validateInput(generateXPath(element), generateCSSSelector(element), element);
        const result = await analyzeElementAsync(element);
        
        // Additional analysis
        const xpathUniqueness = result.recommendedXPath ? await testLocatorAsync(result.recommendedXPath, true) : false;
        const cssUniqueness = result.recommendedCSS ? await testLocatorAsync(result.recommendedCSS, false) : false;
        
        return {
            ...result,
            xpathUniqueness,
            cssUniqueness,
            overallRecommendation: getOverallRecommendation(result, xpathUniqueness, cssUniqueness)
        };
    } catch (error) {
        console.error('Error in analyzeAndSuggestLocator:', error);
        return {
            error: error.message,
            bestLocator: null,
            xpathScore: 0,
            cssScore: 0,
            recommendedXPath: null,
            recommendedCSS: null,
            xpathUniqueness: false,
            cssUniqueness: false,
            overallRecommendation: 'Unable to provide recommendation due to error'
        };
    }
}

function getOverallRecommendation(result, xpathUniqueness, cssUniqueness) {
    if (result.bestLocator === "XPath is better" && xpathUniqueness) {
        return "Use the recommended XPath for best results";
    } else if (result.bestLocator === "CSS is better" && cssUniqueness) {
        return "Use the recommended CSS selector for best results";
    } else if (xpathUniqueness) {
        return "Consider using the XPath for unique element identification";
    } else if (cssUniqueness) {
        return "Consider using the CSS selector for unique element identification";
    } else {
        return "Both locators have issues. Consider refining the element's attributes or structure for better identification";
    }
}

// Example usage
(async () => {
    try {
        // Assume we have a button element with id 'submit-btn'
        const element = document.getElementById('submit-btn');
        if (!element) {
            throw new Error('Element not found');
        }

        const analysis = await analyzeAndSuggestLocator(element);
        console.log('Locator Analysis Result:');
        console.log(JSON.stringify(analysis, null, 2));
    } catch (error) {
        console.error('Error in locator analysis:', error);
    }
})();
