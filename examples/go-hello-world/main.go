package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, World! Welcome to aisanity sandboxed development!")
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "OK")
	})

	fmt.Println("🚀 Server starting on http://localhost:8080")
	fmt.Println("📝 Try: curl http://localhost:8080")
	fmt.Println("💚 Health check: curl http://localhost:8080/health")

	log.Fatal(http.ListenAndServe(":8080", nil))
}
