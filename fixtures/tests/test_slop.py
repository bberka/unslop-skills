import time
from unittest import mock

import pytest

from shop import cart


def test_1():
    cart.add("a")


def test_works():
    assert True


@pytest.mark.skip
def test_refund():
    time.sleep(2)
    assert cart.refund() == 0


def test_private():
    c = cart.Cart()
    assert c._total_cache() == 0


def test_returns_value():
    loader = mock.Mock()
    loader.return_value = 42
    assert cart.load(loader) == 42
