package cart

import "testing"

func TestTotal(t *testing.T) {
	cases := []struct {
		name  string
		items []Item
		want  int
	}{
		{"empty", nil, 0},
		{"two of three", []Item{{Price: 3, Qty: 2}}, 6},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := New(tc.items...).Total(); got != tc.want {
				t.Fatalf("Total() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestCheckoutClearsTheBasket(t *testing.T) {
	c := New(Item{Price: 3, Qty: 1})
	assertNoErr(t, c.Checkout())
	raw := `{"items": []}`
	assertJSON(c, raw, t)
}

func assertNoErr(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func assertJSON(c *Cart, want string, t *testing.T) {
	if got := c.JSON(); got != want {
		t.Errorf("JSON() = %s, want %s", got, want)
	}
}
