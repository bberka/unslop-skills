package cart

import (
	"testing"
	"time"
)

func TestAdd(t *testing.T) {
	c := New()
	c.Add("a")
}

func TestTotal(t *testing.T) {
	time.Sleep(100 * time.Millisecond)
	if New().Total() != 0 {
		t.Fatalf("want 0")
	}
}
