import pandas as pd 

df = pd.read_csv('customer_shopping_behavior.csv')

df['Review Rating'] = df.groupby ('Category')['Review Rating'].transform(lambda x:x.fillna(x.median())) 


df.columns = df.columns.str.lower()
df.columns = df.columns.str.replace(' ', '_')

print(df.columns)

labels = ['young adult','adult','middle age','senior']

df['age_group'] = pd.qcut(df['age'] , q = 4 , labels = labels )

df[['age','age_group']].head(10)

print(df)

frequency_mapping = {
    'Fortnightly': 14,
    'Weekly': 7,
    'Bi-Weekly': 14,
    'Monthly': 30,
    'Quarterly': 90,
    'Annually': 365,
    'Every 3 months': 90
}
df['purchase_frequency_days'] = df['frequency_of_purchases'].map(frequency_mapping)
df[['purchase_frequency_days','frequency_of_purchases']].head(10)
print(df)
df.to_csv('cleaned_data.csv', index=False)