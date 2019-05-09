# Tap

## State

### reserve

```javascript
Vault public reserve;
```

### beneficiary

```javascript
address public beneficiary;
```

### maxMonthlyTapIncreaseRate

```javascript
uint256 public maxMonthlyTapIncreaseRate;
```



## Events

### UpdateReserve

```javascript
event UpdateReserve(address reserve);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve.
{% endtab %}
{% endtabs %}

### UpdateBeneficiary

```javascript
event UpdateBeneficiary(address beneficiary);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}

### UpdateMaxMonthlyTapIncreaseRate

```javascript
event UpdateReserve(address reserve);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}

### AddTokenTap

```javascript
 event AddTokenTap(address indexed token, uint256 tap);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}

### RemoveTokenTap

```javascript
event RemoveTokenTap(address indexed token);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}

### UpdateTokenTap

```javascript
event UpdateTokenTap(address indexed token, uint256 tap);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}

### Withdraw

```javascript
event Withdraw(address indexed token, uint256 amount);
```

{% tabs %}
{% tab title="Description" %}
Emitted when the reserve has been updated.
{% endtab %}

{% tab title="Parameters" %}
`reserve` Address of the new reserve
{% endtab %}
{% endtabs %}





