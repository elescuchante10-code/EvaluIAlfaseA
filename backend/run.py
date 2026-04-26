"""
Script para ejecutar el servidor de desarrollo.
"""
import uvicorn

if __name__ == "__main__":
    print("Iniciando servidor EvaluAI Backend...")
    print("URL: http://localhost:8000")
    print("Docs: http://localhost:8000/docs")
    print("Test CORS: http://localhost:8000/api/test-cors")
    print("\n" + "=" * 60)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
