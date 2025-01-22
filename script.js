const API_URL = '/tts';

// DOM Elements
const voiceTypeSelect = document.getElementById('voice-type');
const customVoiceSection = document.getElementById('custom-voice-section');
const recordBtn = document.getElementById('record-btn');
const recordingStatus = document.getElementById('recording-status');
const fileInput = document.getElementById('file-input');
const textInput = document.getElementById('text-input');
const generateBtn = document.getElementById('generate-btn');
const downloadBtn = document.getElementById('download-btn');
const readBtn = document.getElementById('read-btn');

// State variables
let audioBlob = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;

// Event Listeners
voiceTypeSelect.addEventListener('change', handleVoiceTypeChange);
recordBtn.addEventListener('click', toggleRecording);
fileInput.addEventListener('change', handleFileUpload);
generateBtn.addEventListener('click', generateAudio);
downloadBtn.addEventListener('click', downloadAudio);
readBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) {
        alert('الرجاء إدخال نص');
        return;
    }
    generateAudio();
});

// Handle voice type selection
function handleVoiceTypeChange() {
    const selectedType = voiceTypeSelect.value;
    customVoiceSection.style.display = selectedType === 'custom' ? 'block' : 'none';
    
    if (selectedType !== 'custom') {
        stopRecording();
    }
}

// Recording functionality
async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        startRecordingTimer();
        recordBtn.textContent = 'إيقاف التسجيل';
    } catch (error) {
        alert('خطأ في الوصول إلى الميكروفون: ' + error.message);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordBtn.textContent = 'بدء التسجيل';
        clearInterval(recordingTimer);
        recordingSeconds = 0;
    }
}

function startRecordingTimer() {
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        recordingStatus.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (recordingSeconds >= 60) {
            stopRecording();
        }
    }, 1000);
}

// File upload handling
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await readFileContent(file);
        textInput.value = text;
    } catch (error) {
        alert('خطأ في قراءة الملف: ' + error.message);
    }
}

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        
        if (file.type === 'text/plain') {
            reader.readAsText(file, 'UTF-8');
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            readDocxFile(file).then(resolve).catch(reject);
        } else {
            reject(new Error('نوع الملف غير مدعوم'));
        }
    });
}

async function readDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.docx.load(arrayBuffer);
    return result.paragraphs.map(p => p.text).join('\n');
}

// Text-to-speech generation
async function generateAudio() {
    const text = textInput.value.trim();
    if (!text) {
        alert('الرجاء إدخال نص');
        return;
    }

    const voiceType = voiceTypeSelect.value;
    const voiceConfig = getVoiceConfig(voiceType);

    // Validate text length
    if (text.length > 1000) {
        alert('النص يجب أن يكون أقل من 1000 حرف');
        return;
    }

    try {
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.textContent = 'جارٍ التوليد...';
        generateBtn.classList.add('loading');
        downloadBtn.disabled = true;

        // Check network connectivity
        if (!navigator.onLine) {
            throw new Error('لا يوجد اتصال بالإنترنت');
        }

        console.log('Sending request to:', API_URL);
        console.log('Request payload:', {
            text: text,
            voice: voiceConfig,
            format: 'mp3',
            quality: 'high',
            language: 'ar'
        });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: voiceConfig,
                format: 'mp3',
                quality: 'high',
                language: 'ar'
            })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: 'فشل في تحليل استجابة الخادم' };
            }
            console.error('API Error:', errorData);
            throw new Error(errorData.error || 'خطأ غير معروف');
        }

        console.log('Request successful');

        const audioData = await response.blob();
        audioBlob = audioData;
        downloadBtn.disabled = false;
        playAudio(audioData);
    } catch (error) {
        alert('خطأ في توليد الصوت: ' + error.message);
        console.error('TTS Error:', error);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'توليد الصوت';
        generateBtn.classList.remove('loading');
    }
}

function getVoiceConfig(voiceType) {
    switch (voiceType) {
        case 'male':
            return { gender: 'male', language: 'ar-SA' };
        case 'female':
            return { gender: 'female', language: 'ar-SA' };
        case 'custom':
            return audioBlob ? { custom_voice: audioBlob } : { gender: 'male', language: 'ar-SA' };
        default:
            return { gender: 'male', language: 'ar-SA' };
    }
}

function playAudio(audioBlob) {
    const audioURL = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioURL);
    audio.play();
}

// Audio download
function downloadAudio() {
    if (!audioBlob) return;

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated_audio_${new Date().toISOString()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize
function init() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        customVoiceSection.style.display = 'none';
        alert('ميزة التسجيل غير مدعومة في هذا المتصفح');
    }
}

init();
