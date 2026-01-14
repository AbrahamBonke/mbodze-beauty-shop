export default function SplashScreen() {
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <img
          src="/src/assets/logo.png"
          alt="Mbodze's Beauty Salon"
          className="w-96 h-auto mx-auto mb-8 animate-fade-in"
        />
        <div className="flex justify-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}
