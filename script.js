// --- CONFIGURATION ---
// The URL to the RAW CSV file on GitHub.
const GITHUB_CSV_URL = 'https://raw.githubusercontent.com/ghiassabir/New-Approach-Quiz-and-Dashboard-11-june/main/data/question_bank.csv';
// The URL of your deployed Google Apps Script Web App.
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwAA7VRzbnJy4XMLJUMlS6X4aqUC2acuQQLbOL1VbV--m6sdXUJ17MswbI855eFTSxd/exec';

// --- DOM ELEMENT REFERENCES ---
const welcomeScreen = document.getElementById('welcomeScreen');
const quizArea = document.getElementById('quizArea');
const confirmationScreen = document.getElementById('confirmationScreen');
const startButton = document.getElementById('startButton');
const studentEmailInput = document.getElementById('studentEmail');
const quizTitle = document.getElementById('quizTitle');
const questionText = document.getElementById('questionText');
const questionImage = document.getElementById('questionImage');
const optionsContainer = document.getElementById('optionsContainer');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const submitButton = document.getElementById('submitButton');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const questionNavigator = document.getElementById('questionNavigator');
const markReviewBtn = document.getElementById('markReviewBtn');

// --- STATE MANAGEMENT VARIABLES ---
let allQuestions = [];
let currentQuizQuestions = [];
let studentAnswers = {};
let markedForReview = new Set();
let currentQuestionIndex = 0;
let questionStartTime = 0;
let studentEmail = '';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    startButton.addEventListener('click', startQuiz);
    const savedEmail = localStorage.getItem('satHubStudentEmail');
    if (savedEmail) {
        studentEmailInput.value = savedEmail;
    }
});

function startQuiz() {
    studentEmail = studentEmailInput.value;
    if (!studentEmail || !studentEmail.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }
    localStorage.setItem('satHubStudentEmail', studentEmail);

    const urlParams = new URLSearchParams(window.location.search);
    let quizName = urlParams.get('quiz');
    if (!quizName) {
        quizName = "CBQ-SQ-M"; // Fallback for testing
    }

    quizTitle.textContent = quizName.replace(/_/g, ' ');
    loadQuestions(quizName);
}

function loadQuestions(quizName) {
    startButton.textContent = "Loading...";
    startButton.disabled = true;

    // For a live site, you would use this Papa.parse with the GITHUB_CSV_URL
    // Papa.parse(GITHUB_CSV_URL, { ... });

    // For this blueprint, we use embedded dummy data to make it runnable
    const allData = getDummyData();
    currentQuizQuestions = allData.filter(q => q.quiz_name === quizName);

    if (currentQuizQuestions.length > 0) {
        welcomeScreen.classList.add('hidden');
        quizArea.classList.remove('hidden');
        buildQuestionNavigator();
        renderQuestion();
    } else {
        alert(`Error: No questions found for quiz: ${quizName}`);
    }
}

function renderQuestion() {
    optionsContainer.innerHTML = '';
    questionImage.classList.add('hidden');

    const question = currentQuizQuestions[currentQuestionIndex];
    questionText.innerHTML = question.question_text;

    if (question.image_url) {
        questionImage.src = question.image_url;
        questionImage.classList.remove('hidden');
    }

    ['a', 'b', 'c', 'd'].forEach(optKey => {
        const optionText = question[`option_${optKey}`];
        if (optionText) {
            const optionElement = document.createElement('div');
            optionElement.className = 'answer-option p-4 rounded-lg';
            optionElement.innerHTML = `<label class="flex items-center cursor-pointer w-full"><input type="radio" name="answer" value="${optionText}" class="mr-3 shrink-0"><span>${optionText}</span></label>`;
            
            optionElement.addEventListener('click', () => {
                optionElement.querySelector('input').checked = true;
                handleOptionSelection();
            });

            if (studentAnswers[question.question_id] && studentAnswers[question.question_id].answer === optionText) {
                optionElement.classList.add('selected');
                optionElement.querySelector('input').checked = true;
            }
            optionsContainer.appendChild(optionElement);
        }
    });
    
    // --- THIS IS THE CRITICAL FIX FOR MATHJAX ---
    // After new content is added to the DOM, we tell MathJax to look for it and render it.
    if (window.MathJax) {
        MathJax.typesetPromise();
    }

    updateUI();
    questionStartTime = Date.now();
}

function handleOptionSelection() {
    document.querySelectorAll('.answer-option').forEach(el => {
        el.classList.remove('selected');
        if (el.querySelector('input').checked) {
            el.classList.add('selected');
        }
    });
}

function updateUI() {
    updateNavigation();
    updateProgressBar();
    updateNavigator();
    updateMarkForReviewButton();
}

function buildQuestionNavigator() {
    questionNavigator.innerHTML = '';
    currentQuizQuestions.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.textContent = index + 1;
        btn.className = 'question-nav-btn p-2 rounded';
        btn.dataset.index = index;
        btn.onclick = () => jumpToQuestion(index);
        questionNavigator.appendChild(btn);
    });
}

function updateNavigator() {
    const buttons = questionNavigator.querySelectorAll('.question-nav-btn');
    buttons.forEach((btn, index) => {
        const questionId = currentQuizQuestions[index].question_id;
        btn.classList.remove('current', 'answered', 'unanswered', 'marked');
        if (index === currentQuestionIndex) btn.classList.add('current');
        if (studentAnswers[questionId]) btn.classList.add('answered');
        else btn.classList.add('unanswered');
        if (markedForReview.has(questionId)) btn.classList.add('marked');
    });
}

function updateNavigation() {
    prevButton.disabled = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === currentQuizQuestions.length - 1;
    nextButton.classList.toggle('hidden', isLastQuestion);
    submitButton.classList.toggle('hidden', !isLastQuestion);
}

function updateProgressBar() {
    const progress = ((currentQuestionIndex + 1) / currentQuizQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuizQuestions.length}`;
}

function updateMarkForReviewButton() {
    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    markReviewBtn.classList.toggle('active', markedForReview.has(questionId));
}

function recordAnswer() {
    const selectedOption = optionsContainer.querySelector('input[name="answer"]:checked');
    if (selectedOption) {
        const timeSpent = (Date.now() - questionStartTime) / 1000;
        const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
        const existingTime = studentAnswers[questionId] ? parseFloat(studentAnswers[questionId].timeSpent) : 0;
        studentAnswers[questionId] = {
            answer: selectedOption.value,
            timeSpent: (existingTime + timeSpent).toFixed(2)
        };
        updateNavigator();
    }
}

function submitQuiz() { /* Submission logic here */ }

function jumpToQuestion(index) {
    recordAnswer();
    currentQuestionIndex = index;
    renderQuestion();
}

nextButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex + 1); });
prevButton.addEventListener('click', () => { recordAnswer(); jumpToQuestion(currentQuestionIndex - 1); });
submitButton.addEventListener('click', () => { recordAnswer(); submitQuiz(); });
markReviewBtn.addEventListener('click', () => {
    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    if (markedForReview.has(questionId)) markedForReview.delete(questionId);
    else markedForReview.add(questionId);
    updateNavigator();
    updateMarkForReviewButton();
});

// Mock Data Function for testing
function getDummyData() {
    return [
        { quiz_name: "Sample-Math-Quiz", question_id: "MQ1", question_text: "What is the value of $P$ in the formula $P = \\frac{V^2}{R}$ when $V=12$ and $R=3$?", option_a: "$P=48$", option_b: "$P=36$", option_c: "$P=144$", option_d: "$P=24$", correct_answer: "$P=48$" },
        { quiz_name: "Sample-Math-Quiz", question_id: "MQ2", question_text: "If $x^2 = 144$, what is the value of $x$?", option_a: "12", option_b: "10", option_c: "24", option_d: "72", correct_answer: "12" }
    ];
}
