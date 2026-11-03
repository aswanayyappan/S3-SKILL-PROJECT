import ngrok from '@ngrok/ngrok';

async function startTunnel() {
  try {
    const listener = await ngrok.forward({
      addr: 3000,
      authtoken: '3HPjeEpvVvFT3M0JbxHBlQZ3STF_TmZ7Bgk1eS7nZKDyYZ9w',
      domain: 'jacket-untreated-single.ngrok-free.dev'
    });
    console.log(`🚀 ngrok tunnel live at: ${listener.url()}`);
    
    // Keep alive
    process.stdin.resume();
  } catch (err) {
    console.error('ngrok error:', err);
  }
}

startTunnel();
