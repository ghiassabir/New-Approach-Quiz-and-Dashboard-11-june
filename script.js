// --- CONFIGURATION ---
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwAA7VRzbnJy4XMLJUMlS6X4aqUC2acuQQLbOL1VbV--m6sdXUJ17MswbI855eFTSxd/exec';
const GITHUB_CSV_URL = '';
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
        quizName = "EOC-M-C1-AlgebraBasics"; // Fallback for testing
    }

    quizTitle.textContent = quizName.replace(/_/g, ' ');
    loadQuestions(quizName);
}

function loadQuestions(quizName) {
    // For this blueprint, we use embedded dummy data.
    // In production, this would be a Papa.parse call to your GitHub CSV URL.
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

// --- RENDERING & UI ---
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
            optionElement.className = 'answer-option p-4 rounded-lg cursor-pointer flex items-start';
            optionElement.innerHTML = `
                <input type="radio" name="answer" value="${optionText}" class="mr-3 mt-1 shrink-0">
                <label class="cursor-pointer w-full">${optionText}</label>`;
            
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
    
    updateUI();
    questionStartTime = Date.now();
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

// --- EVENT HANDLING ---
function handleOptionSelection() {
    document.querySelectorAll('.answer-option').forEach(el => {
        el.classList.remove('selected');
        if (el.querySelector('input').checked) {
            el.classList.add('selected');
        }
    });
}

function jumpToQuestion(index) {
    recordAnswer();
    currentQuestionIndex = index;
    renderQuestion();
}

nextButton.addEventListener('click', () => {
    recordAnswer();
    currentQuestionIndex++;
    renderQuestion();
});

prevButton.addEventListener('click', () => {
    recordAnswer();
    currentQuestionIndex--;
    renderQuestion();
});

submitButton.addEventListener('click', () => {
    recordAnswer();
    submitQuiz();
});

markReviewBtn.addEventListener('click', () => {
    const questionId = currentQuizQuestions[currentQuestionIndex].question_id;
    if (markedForReview.has(questionId)) {
        markedForReview.delete(questionId);
    } else {
        markedForReview.add(questionId);
    }
    updateNavigator();
    updateMarkForReviewButton();
});


// --- DATA LOGIC ---
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

function submitQuiz() {
    // ... (Submission logic remains the same as previous blueprint)
}

// --- DUMMY DATA ---
function getDummyData() {
    // This uses the dummy data you provided to make the preview work.
    return [
        {"question_id":"EOC-M-C1-AlgebraBasics-Q1","quiz_name":"EOC-M-C1-AlgebraBasics","subject":"Math","domain":"Algebra","skill_tag":"Linear equations in 1 variable","difficulty":"Easy","question_text":"If 5x - 7 = 28, what is the value of x?","image_url":"","option_a":"5","option_b":"7","option_c":"9","option_d":"35","correct_answer":"7","explanation_original":"Add 7 to both sides...","explanation_ai_enhanced":"This is a two-step linear equation..."},
        {"question_id":"EOC-M-C1-AlgebraBasics-Q2","quiz_name":"EOC-M-C1-AlgebraBasics","subject":"Math","domain":"Algebra","skill_tag":"Linear inequalities","difficulty":"Medium","question_text":"Which of the following numbers is a solution to the inequality 3(y - 2) < 15?","image_url":"","option_a":"-2","option_b":"7","option_c":"8","option_d":"10","correct_answer":"-2","explanation_original":"Distribute the 3 to get 3y - 6 < 15...","explanation_ai_enhanced":"To solve the inequality..."},
        {"question_id":"EOC-M-C2-Geometry-Q1","quiz_name":"EOC-M-C2-Geometry","subject":"Math","domain":"Geometry and Trigonometry","skill_tag":"Area and volume","difficulty":"Easy","question_text":"A rectangular prism has a length of 6 cm, a width of 4 cm, and a height of 5 cm. What is the volume of the prism?","image_url":"","option_a":"15 cm³","option_b":"24 cm³","option_c":"120 cm³","option_d":"150 cm³","correct_answer":"120 cm³","explanation_original":"The volume of a rectangular prism is...","explanation_ai_enhanced":"The formula for the volume..."},
        {"question_id":"CB-T1-M1-Q1","quiz_name":"CB-T1-M1","subject":"Math","domain":"Algebra","skill_tag":"Linear equations in 1 variable","difficulty":"Easy","question_text":"If 3x + 9 = 15, what is the value of 6x?","image_url":"","option_a":"2","option_b":"6","option_c":"12","option_d":"18","correct_answer":"12","explanation_original":"First, solve for x...","explanation_ai_enhanced":"This is a two-step problem..."}
    ];
}
