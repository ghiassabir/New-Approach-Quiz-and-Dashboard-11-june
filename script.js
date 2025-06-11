// --- CONFIGURATION ---
// IMPORTANT: Replace these placeholder URLs with your actual URLs.
const GITHUB_CSV_URL = 'https://github.com/ghiassabir/New-Approach-Quiz-and-Dashboard-11-june/blob/main/data/question_bank.csv'; // e.g., https://raw.githubusercontent.com/your-username/your-repo/main/data/question_bank.csv
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwAA7VRzbnJy4XMLJUMlS6X4aqUC2acuQQLbOL1VbV--m6sdXUJ17MswbI855eFTSxd/exec';

// --- DOM ELEMENT REFERENCES ---
const welcomeScreen = document.getElementById('welcomeScreen');
const quizArea = document.getElementById('quizArea');
const confirmationScreen = document.getElementById('confirmationScreen');
const startButton = document.getElementById('startButton');
const studentEmailInput = document.getElementById('studentEmail');
const quizTitle = document.getElementById('quizTitle');
const timerDisplay = document.getElementById('timer');
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
let quizTimerInterval;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    startButton.addEventListener('click', startQuiz);
    // Check for a saved email to make it easier for returning students
    const savedEmail = localStorage.getItem('satHubStudentEmail');
    if (savedEmail) {
        studentEmailInput.value = savedEmail;
    }
});

/**
 * Validates email, gets the quiz name from the URL, and starts the question loading process.
 */
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
        alert(`No quiz name found in URL. Loading default test: ${quizName}`);
    }

    quizTitle.textContent = quizName.replace(/_/g, ' ');
    loadQuestions(quizName);
}

/**
 * Fetches the CSV from GitHub (or uses dummy data) and filters for the specific quiz.
 * @param {string} quizName - The name of the quiz to filter by.
 */
function loadQuestions(quizName) {
    startButton.textContent = "Loading...";
    startButton.disabled = true;

    // For this blueprint, we use embedded dummy data.
    // In production, you would uncomment the Papa.parse call.
    const allData = getDummyData(); 
    processQuestionData(allData, quizName);
    
    /*
    // --- PRODUCTION CODE ---
    Papa.parse(GITHUB_CSV_URL, {
        download: true,
        header: true,
        complete: (results) => processQuestionData(results.data, quizName),
        error: (error) => {
            console.error("PapaParse Error:", error);
            alert("Failed to load quiz data. Please check the CSV URL in script.js.");
            startButton.textContent = "Start Quiz";
            startButton.disabled = false;
        }
    });
    */
}

/**
 * Processes the loaded question data and starts the quiz.
 * @param {Array} data - The full dataset from the CSV.
 * @param {string} quizName - The name of the quiz to run.
 */
function processQuestionData(data, quizName) {
    allQuestions = data;
    currentQuizQuestions = allQuestions.filter(q => q.quiz_name === quizName);

    if (currentQuizQuestions.length > 0) {
        welcomeScreen.classList.add('hidden');
        quizArea.classList.remove('hidden');
        startQuizTimer(currentQuizQuestions.length * 90); // Example: 90 seconds per question
        buildQuestionNavigator();
        renderQuestion();
    } else {
        alert(`Error: No questions found for quiz named "${quizName}".`);
        startButton.textContent = "Start Quiz";
        startButton.disabled = false;
    }
}


// --- RENDERING & UI ---

/**
 * Renders the current question, its options, and associated image if available.
 */
function renderQuestion() {
    optionsContainer.innerHTML = '';
    questionImage.classList.add('hidden');

    const question = currentQuizQuestions[currentQuestionIndex];
    questionText.innerHTML = question.question_text;

    if (question.image_url && question.image_url.trim() !== "") {
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

            const questionId = question.question_id;
            if (studentAnswers[questionId] && studentAnswers[questionId].answer === optionText) {
                optionElement.classList.add('selected');
                optionElement.querySelector('input').checked = true;
            }
            optionsContainer.appendChild(optionElement);
        }
    });
    
    updateUI();
    questionStartTime = Date.now();
}

/**
 * Updates all UI components at once.
 */
function updateUI() {
    updateNavigation();
    updateProgressBar();
    updateNavigator();
    updateMarkForReviewButton();
}

/**
 * Creates the question navigator buttons on the side panel.
 */
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

/**
 * Updates the visual state of the question navigator (current, answered, marked).
 */
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

/**
 * Shows/hides the Previous, Next, and Submit buttons based on the current question index.
 */
function updateNavigation() {
    prevButton.disabled = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === currentQuizQuestions.length - 1;
    nextButton.classList.toggle('hidden', isLastQuestion);
    submitButton.classList.toggle('hidden', !isLastQuestion);
}

/**
 * Updates the visual progress bar and text.
 */
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
    if (currentQuestionIndex < currentQuizQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
});

prevButton.addEventListener('click', () => {
    recordAnswer();
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
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
    updateUI();
});

// --- TIMER LOGIC ---
function startQuizTimer(durationInSeconds) {
    let timer = durationInSeconds;
    quizTimerInterval = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        let seconds = timer % 60;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        timerDisplay.textContent = `${minutes}:${seconds}`;
        if (--timer < 0) {
            clearInterval(quizTimerInterval);
            alert("Time's up!");
            submitQuiz();
        }
    }, 1000);
}

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
    }
}

function submitQuiz() {
    clearInterval(quizTimerInterval); // Stop the timer
    submitButton.textContent = "Submitting...";
    submitButton.disabled = true;

    const submissionData = currentQuizQuestions.map(question => {
        const studentResponse = studentAnswers[question.question_id];
        return {
            timestamp: new Date().toISOString(),
            student_gmail_id: studentEmail,
            quiz_name: question.quiz_name,
            question_id: question.question_id,
            student_answer: studentResponse ? studentResponse.answer : 'NO_ANSWER',
            is_correct: studentResponse ? studentResponse.answer === question.correct_answer : false,
            time_spent_seconds: studentResponse ? studentResponse.timeSpent : 0
        };
    });
    
    console.log("Submitting Data:", submissionData);
    
    fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(submissionData),
    })
    .then(() => {
        console.log("Submission successful.");
        quizArea.classList.add('hidden');
        confirmationScreen.classList.remove('hidden');
    })
    .catch(error => {
        console.error('Error submitting quiz:', error);
        alert('There was an error submitting your quiz. Please try again.');
        submitButton.textContent = "Submit Quiz";
        submitButton.disabled = false;
    });
}

// --- DUMMY DATA ---
function getDummyData() {
    return [
        {"question_id":"EOC-M-C1-AlgebraBasics-Q1","quiz_name":"EOC-M-C1-AlgebraBasics","subject":"Math","domain":"Algebra","skill_tag":"Linear equations in 1 variable","difficulty":"Easy","question_text":"If 5x - 7 = 28, what is the value of x?","image_url":"","option_a":"5","option_b":"7","option_c":"9","option_d":"35","correct_answer":"7","explanation_original":"Add 7 to both sides..."},
        {"question_id":"EOC-M-C1-AlgebraBasics-Q2","quiz_name":"EOC-M-C1-AlgebraBasics","subject":"Math","domain":"Algebra","skill_tag":"Linear inequalities","difficulty":"Medium","question_text":"Which of the following numbers is a solution to the inequality 3(y - 2) < 15?","image_url":"","option_a":"-2","option_b":"7","option_c":"8","option_d":"10","correct_answer":"-2","explanation_original":"Distribute the 3..."}
    ];
}
