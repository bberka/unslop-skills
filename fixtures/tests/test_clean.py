import pytest

from shop import cart


@pytest.fixture
def test_app():
    return cart.App()


@pytest.mark.parametrize(
    ("items", "total"),
    [([], 0), ([("a", 3, 2)], 6)],
)
def test_total_is_price_times_quantity(items, total):
    assert cart.Cart(items).total() == total


def test_rejects_negative_quantity(
    test_app, monkeypatch
) -> None:
    """Quantities below one raise."""

    def test_handler():
        return "nested view function, not a test"

    with pytest.raises(ValueError, match="quantity"):
        test_app.add("a", qty=-1)


def test_checkout_clears_the_basket():
    c = cart.Cart([("a", 3, 1)])
    c.checkout()
    assert_empty(c)


def assert_empty(c):
    assert c.items == []


class TestLegacy:
    def test_count(self):
        self.assertEqual(cart.Cart([]).count(), 0)
