const form = document.getElementById('uploadForm');
const result = document.getElementById('result');
const uploadedImage = document.getElementById('uploadedImage');
const qrImage = document.getElementById('qrImage');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('imageInput');
  if (!input.files || input.files.length === 0) return;

  const fd = new FormData();
  fd.append('image', input.files[0]);

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  try {
    const resp = await fetch('/upload', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Upload failed');
    const data = await resp.json();

    uploadedImage.src = data.imageUrl;
    qrImage.src = data.qrDataUrl;
    result.hidden = false;
  } catch (err) {
    alert('Upload failed');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload & Generate QR';
  }
});


